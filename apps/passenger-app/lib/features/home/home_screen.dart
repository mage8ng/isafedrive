import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../services/api_client.dart';
import '../ride/book_ride_sheet.dart';
import '../ride/rides_history_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _wallet;

  @override
  void initState() {
    super.initState();
    _loadWallet();
  }

  Future<void> _loadWallet() async {
    try {
      final wallet = await ApiClient.instance.get('/passengers/wallet');
      if (!mounted) return;
      setState(() => _wallet = wallet);
    } on ApiException {
      setState(() => _wallet = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppConstants.appName),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'Ride history',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const RidesHistoryScreen()),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          Container(
            width: double.infinity,
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.map_outlined,
                  size: 96,
                  color: Colors.grey.shade500,
                ),
                const SizedBox(height: 8),
                const Text('Live map placeholder'),
                const Text(
                  'Add google_maps_flutter + API key to render the map',
                  style: TextStyle(fontSize: 12),
                ),
              ],
            ),
          ),
          Positioned(
            top: 16,
            left: 16,
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.account_balance_wallet_outlined),
                    const SizedBox(width: 8),
                    Text(
                      '${AppConstants.currencySymbol}${_wallet?['balance'] ?? '--'}',
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      bottomSheet: const BookRideSheet(),
    );
  }
}
