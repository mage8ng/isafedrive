import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../home/home_screen.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key, required this.phone});

  final String phone;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _codeController = TextEditingController();
  bool _busy = false;

  Future<void> _verify() async {
    setState(() => _busy = true);
    try {
      final res = await ApiClient.instance.post('/auth/verify-otp', {
        'phone': widget.phone,
        'code': _codeController.text.trim(),
      });
      final tokens = res['accessToken'] != null
          ? {
              'accessToken': res['accessToken'],
              'refreshToken': res['refreshToken'],
            }
          : null;
      if (tokens != null) {
        await ApiClient.instance.saveSession(
          accessToken: tokens['accessToken'] as String,
          refreshToken: tokens['refreshToken'] as String,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
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
    return Scaffold(
      appBar: AppBar(title: const Text('Verify OTP')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text('Enter the 6-digit code sent to ${widget.phone}'),
            const SizedBox(height: 24),
            TextField(
              controller: _codeController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
              decoration: const InputDecoration(
                counterText: '',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy || _codeController.text.length < 6
                  ? null
                  : _verify,
              child: Text(_busy ? 'Verifying...' : 'Verify and continue'),
            ),
          ],
        ),
      ),
    );
  }
}
