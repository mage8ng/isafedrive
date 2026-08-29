import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'features/auth/login_screen.dart';

class ISafeDriveDriverApp extends StatelessWidget {
  const ISafeDriveDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'iSafeDrive Driver',
      debugShowCheckedModeBanner: false,
      theme: ISafeDriveTheme.light(),
      home: const LoginScreen(),
    );
  }
}
