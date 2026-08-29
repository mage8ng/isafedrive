import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../services/api_client.dart';
import '../kyc/kyc_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _online = false;
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _earnings;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final profile =
          await ApiClient.instance.get('/drivers/profile');
      final earnings = await ApiClient.instance.get('/drivers/earnings');
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _earnings = earnings;
        _online = (profile['onlineStatus'] ?? 'offline') == 'online';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _toggleOnline(bool value) async {
    setState(() => _online = value);
    try {
      await ApiClient.instance.post(
        value ? '/drivers/go-online' : '/drivers/go-offline',
        if (value) {'latitude': 6.5244, 'longitude': 3.3792} else {},
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _online = !value);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final kyc = _profile?['kycStatus'] ?? 'pending';
    return Scaffold(
      appBar: AppBar(title: const Text(AppConstants.appName)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: SwitchListTile(
                title: Text(_online ? 'You are ONLINE' : 'You are OFFLINE'),
                subtitle: const Text(
                  'Toggle to start or stop receiving ride requests',
                ),
                value: _online,
                onChanged: kyc == 'approved' ? _toggleOnline : null,
              ),
            ),
            if (kyc != 'approved')
              Card(
                color: Colors.amber.shade100,
                child: ListTile(
                  leading: const Icon(Icons.verified_user_outlined),
                  title: Text('KYC status: $kyc'),
                  subtitle: const Text(
                    'Submit your documents for verification to go online.',
                  ),
                  trailing: FilledButton.tonal(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const KycScreen()),
                    ),
                    child: const Text('Submit'),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                _StatCard(
                  label: 'Today',
                  value:
                      '${AppConstants.currencySymbol}${_earnings?['today'] ?? 0}',
                ),
                _StatCard(
                  label: 'Total',
                  value:
                      '${AppConstants.currencySymbol}${_earnings?['total'] ?? 0}',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _StatCard(
                  label: 'Rating',
                  value:
                      '${_earnings?['statistics']?['averageRating'] ?? '-'}',
                ),
                _StatCard(
                  label: 'Rides',
                  value:
                      '${_earnings?['statistics']?['completedRides'] ?? 0}',
                ),
              ],
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.navigation_outlined),
              label: const Text('Open navigation'),
            ),
            const SizedBox(height: 8),
            const Text(
              'Ride requests arrive via the /realtime websocket '
              '(event: ride_request). Accept within the timeout shown.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Text(label, style: Theme.of(context).textTheme.bodySmall),
              Text(value, style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
        ),
      ),
    );
  }
}
