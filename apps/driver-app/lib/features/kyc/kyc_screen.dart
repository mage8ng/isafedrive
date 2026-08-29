import 'package:flutter/material.dart';

import '../../services/api_client.dart';

class KycScreen extends StatefulWidget {
  const KycScreen({super.key});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  final _licenseController = TextEditingController();
  bool _busy = false;

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await ApiClient.instance.post('/drivers/kyc', {
        'governmentId': 'doc://government-id.jpg',
        'driversLicense': 'doc://drivers-license.jpg',
        'selfie': 'doc://selfie.jpg',
        'proofOfAddress': 'doc://address.pdf',
        'licenseNumber': _licenseController.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Documents submitted for review'),
      ));
      Navigator.of(context).pop();
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
      appBar: AppBar(title: const Text('Driver KYC')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const ListTile(
            leading: Icon(Icons.badge_outlined),
            title: Text('Government ID'),
            subtitle: Text('Upload placeholder wired - connect file picker'),
          ),
          const ListTile(
            leading: Icon(Icons.credit_card),
            title: Text("Driver's licence"),
            subtitle: Text('Upload placeholder wired - connect file picker'),
          ),
          const ListTile(
            leading: Icon(Icons.face_retouching_natural),
            title: Text('Selfie'),
            subtitle: Text('Upload placeholder wired - connect file picker'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _licenseController,
            decoration: const InputDecoration(
              labelText: 'Licence number',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? 'Submitting...' : 'Submit for review'),
          ),
        ],
      ),
    );
  }
}
