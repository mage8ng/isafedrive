import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../services/api_client.dart';

class RidesHistoryScreen extends StatefulWidget {
  const RidesHistoryScreen({super.key});

  @override
  State<RidesHistoryScreen> createState() => _RidesHistoryScreenState();
}

class _RidesHistoryScreenState extends State<RidesHistoryScreen> {
  List<dynamic> _rides = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiClient.instance.get('/passengers/rides');
      if (!mounted) return;
      setState(() {
        _rides = res is List ? res : (res['rides'] as List<dynamic>? ?? []);
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ride history')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _rides.isEmpty
              ? const Center(child: Text('No rides yet'))
              : ListView.separated(
                  itemCount: _rides.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final ride = _rides[index] as Map<String, dynamic>;
                    return ListTile(
                      leading: const Icon(Icons.local_taxi_outlined),
                      title: Text(ride['destinationAddress'] ?? ''),
                      subtitle: Text(ride['status'] ?? ''),
                      trailing: Text(
                        '${AppConstants.currencySymbol}${ride['fare'] ?? ''}',
                      ),
                    );
                  },
                ),
    );
  }
}
