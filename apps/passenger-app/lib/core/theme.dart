import 'package:flutter/material.dart';

class AppConstants {
  static const String appName = 'iSafeDrive';
  static const String tagline = 'Safe Rides. Trusted Drivers. Better Journeys.';
  static const String defaultApiBaseUrl = 'http://10.0.2.2:3000/api/v1';
  static const String currencySymbol = 'NGN ';
}

class ISafeDriveTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      colorSchemeSeed: const Color(0xFF0A7C42),
      brightness: Brightness.light,
    );
    return base.copyWith(
      appBarTheme: const AppBarTheme(centerTitle: true),
    );
  }
}
