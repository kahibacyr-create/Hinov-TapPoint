# Security Specification for Firestore Rules

This document specifies the security requirements, invariants, and threat analysis for the QR Attendance system.

## Data Invariants

1. **User Accounts (`/users/{userId}`)**:
   - Only admins can create or edit users.
   - An employee can read their own profile but cannot alter their role or email.
   - Usernames and search values must be validated.

2. **Attendances (`/presences/{presenceId}`)**:
   - Registering a scan is highly protected.
   - Users can read their own scan logs. Admins can read all scan logs.
   - A scan record cannot be modified once created.

3. **Stations (`/stations/{stationId}`)**:
   - Only admins can manage (create, update, delete) stations.
   - Stations can be read publicly to verify kiosk status.

4. **Access Codes & QR Tokens**:
   - High-integrity temporary data.
   - Only verified administrators or kiosks with secure server credentials should create these.

## The "Dirty Dozen" Threat Payloads

1. **Identity Spoofing**: An unauthenticated user attempts to view user list. (Action: List users -> Rejected)
2. **Privilege Escalation**: An employee attempts to elevate their role to `admin`. (Action: Update user -> Rejected)
3. **Orphaned Presence**: Adding a clock-in record with an invalid or non-existent employee ID. (Action: Create presence -> Rejected)
4. **Faked Timestamp**: Sending a physical timestamp in the past to alter record books. (Action: Create presence with a spoofed date/time -> Rejected)
5. **Junk ID Insertion**: Writing a document with an extremely long or path-breaking ID. (Action: Create station with 1MB ID string -> Rejected)
6. **Station Tampering**: An employee attempts to disable a QR station. (Action: Update station active state -> Rejected)
7. **Replay Token Poisoning**: Injecting an arbitrary active QR Token. (Action: Create QR Token as anonymous -> Rejected)
8. **Malicious Presence Spammer**: Altering another employee's clock-in entries. (Action: Update or Delete user presence -> Rejected)
9. **Kiosk Hijack**: Changing the linked station ID of an access code to bypass authorization gates. (Action: Update access code -> Rejected)
10. **Data Scraping / Blanket Reads**: Querying the entire presences collection without an employee-specific filter. (Action: List presences -> Rejected)
11. **Profile Self-Approval**: A registering employee setting their own account as pre-verified / admin. (Action: Create user with role `admin` -> Rejected)
12. **Double Clocking Exploits**: Creating subsequent records directly bypasses the strict server-side sequence. (Action: Edit presence logs -> Rejected)

## Firestore Security Rules Draft

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Catch-all default deny
    match /{document=**} {
      allow read, write: if false;
    }

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isSignedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid)) && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    // Since our app operates through a Node.js full-stack backend (server.ts),
    // most DB writes are executed securely server-side. However, we define robust client rules
    // to secure the database should the client interact directly.
  }
}
```
