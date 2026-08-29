import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'features/auth/login_screen.dart';

class ISafeDrivePassengerApp extends StatelessWidget {
  const ISafeDrivePassengerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'iSafeDrive',
      debugShowCheckedModeBanner: false,
      theme: ISafeDriveTheme.light(),
      home: const LoginScreen(),
    );
  }
}
