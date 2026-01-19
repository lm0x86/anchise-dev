'use client';

import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure platform settings and preferences
        </p>
      </div>

      {/* Placeholder */}
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent mb-4">
          <Settings className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-medium mb-2">Platform Settings</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Platform configuration options will be available here. Manage email templates, 
          notification settings, and other system preferences.
        </p>
      </div>
    </div>
  );
}

