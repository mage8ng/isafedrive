import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../services/api_client.dart';
import 'ride_tracking_screen.dart';

class VehicleCategoryTile {
  final String id;
  final String name;
  final IconData icon;

  const VehicleCategoryTile(this.id, this.name, this.icon);
}

const categories = [
  VehicleCategoryTile('economy', 'iSafe Economy', Icons.directions_car_outlined),
  VehicleCategoryTile('comfort', 'iSafe Comfort', Icons.airline_seat_recline_extra),
  VehicleCategoryTile('xl', 'iSafe XL', Icons.directions_bus_outlined),
  VehicleCategoryTile('premium', 'iSafe Premium', Icons.star_border),
  VehicleCategoryTile('motorcycle', 'iSafe Bike', Icons.two_wheeler),
  VehicleCategoryTile('tricycle', 'iSafe Keke', Icons.directions_transit),
];

class BookRideSheet extends StatefulWidget {
  const BookRideSheet({super.key});

  @override
  State<BookRideSheet> createState() => _BookRideSheetState();
}

class _BookRideSheetState extends State<BookRideSheet> {
  final _pickup = TextEditingController();
  final _destination = TextEditingController();
  String _selectedCategory = 'economy';
  bool _busy = false;
  Map<String, dynamic>? _estimate;

  Future<void> _getEstimate() async {
    setState(() => _busy = true);
    try {
      final res = await ApiClient.instance.post('/rides/estimate', {
        'categoryId': _selectedCategory,
        'pickupLatitude': 6.5244,
        'pickupLongitude': 3.3792,
        'destinationLatitude': 6.6018,
        'destinationLongitude': 3.3515,
      });
      if (!mounted) return;
      setState(() => _estimate = res);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _bookRide() async {
    setState(() => _busy = true);
    try {
      await ApiClient.instance.post('/rides', {
        'categoryId': _selectedCategory,
        'pickupAddress': _pickup.text.trim().isEmpty
            ? 'Current location'
            : _pickup.text.trim(),
        'pickupLatitude': 6.5244,
        'pickupLongitude': 3.3792,
        'destinationAddress': _destination.text.trim().isEmpty
            ? 'Destination'
            : _destination.text.trim(),
        'destinationLatitude': 6.6018,
        'destinationLongitude': 3.3515,
        'paymentMethod': 'cash',
      });
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const RideTrackingScreen()),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          boxShadow: const [BoxShadow(blurRadius: 10, color: Colors.black26)],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _pickup,
              decoration: const InputDecoration(
                labelText: 'Pickup',
                prefixIcon: Icon(Icons.trip_origin),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _destination,
              decoration: const InputDecoration(
                labelText: 'Where to?',
                prefixIcon: Icon(Icons.location_on_outlined),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 84,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final category = categories[index];
                  final selected = category.id == _selectedCategory;
                  return ChoiceChip(
                    selected: selected,
                    onSelected: (_) =>
                        setState(() => _selectedCategory = category.id),
                    label: SizedBox(
                      width: 92,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(category.icon, size: 24),
                          const SizedBox(height: 4),
                          Text(
                            category.name,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            if (_estimate != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  '${_estimate!['distanceKm']} km - '
                  '${AppConstants.currencySymbol}${_estimate!['fare']} '
                  '(~${_estimate!['durationMinutes']} min)',
                  textAlign: TextAlign.center,
                ),
              ),
            Row(
              children: [
                OutlinedButton(
                  onPressed: _busy ? null : _getEstimate,
                  child: const Text('Estimate'),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _busy ? null : _bookRide,
                    icon: const Icon(Icons.local_taxi),
                    label: const Text('Book ride'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
