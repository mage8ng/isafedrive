import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../dashboard/dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  bool _registering = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.loadSession();
  }

  Future<void> _continue() async {
    setState(() => _busy = true);
    final client = ApiClient.instance;
    try {
      if (_registering) {
        await client.post('/auth/register', {
          'fullName': _nameController.text.trim(),
          'phone': _phoneController.text.trim(),
          'role': 'driver',
        });
      } else {
        await client.post('/auth/login',
            {'phone': _phoneController.text.trim()});
      }
      await client.post(
        '/auth/send-otp',
        {'phone': _phoneController.text.trim()},
      );
      if (!mounted) return;
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) =>
            OtpScreen(phone: _phoneController.text.trim()),
      ));
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
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Icon(Icons.directions_car_filled, size: 72),
              const SizedBox(height: 12),
              Text(
                AppConstants.appName,
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .headlineMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const Text('Drive with iSafeDrive and earn on your schedule',
                  textAlign: TextAlign.center),
              const Spacer(),
              if (_registering)
                TextField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Full name',
                    border: OutlineInputBorder(),
                  ),
                ),
              if (_registering) const SizedBox(height: 12),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Phone number',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : _continue,
                child:
                    Text(_busy ? 'Please wait...' : 'Continue as driver'),
              ),
              TextButton(
                onPressed: () => setState(() => _registering = !_registering),
                child: Text(_registering
                    ? 'Already registered? Sign in'
                    : 'New driver? Register'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
