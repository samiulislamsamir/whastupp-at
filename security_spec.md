# Security Specification - School Workflow Automation

## Data Invariants
1. A student's roll number must be unique (enforced by application logic and document IDs if possible, but rules will validate type).
2. Only authenticated users can manage students and attendance.
3. Scheduled messages must have a future date.
4. Attendance reports are tied to a specific date.

## The Dirty Dozen (Vulnerability Test Payloads)
1. **Unauthorized Student Creation**: Non-logged in user tries to add a student.
2. **Identity Spoofing**: User A tries to modify a student that User B added (if we add ownership later).
3. **Ghost Field Injection**: Adding a student with an extra `isVerified: true` field.
4. **Invalid Roll Number**: Adding a student with a string for a roll number or a negative number.
5. **PII Leak**: Unauthorized user tries to list all student phone numbers.
6. **State Shortcut**: Updating a scheduled message status directly to 'sent' without system trigger.
7. **Resource Poisoning**: Sending a 1MB string as a student name.
8. **Invalid Timestamp**: Client-side setting of `createdAt` to a past date.
9. **Orphaned Record**: Adding an attendance report without stats.
10. **System-Only Field Modification**: Modifying the `status` of a message after it's in a terminal state.
11. **Regex Bypass**: Using special characters in IDs if they were validated with a regex.
12. **Bulk Scrape**: Attempting a `list` query without any filters as an unauthenticated user.

## Rules Draft Strategy
The rules will implement:
- `isSignedIn()` check.
- `isValidStudent()`, `isValidMessage()`, `isValidReport()` helpers.
- Attribute level protection for updates.
- Server timestamp validation.
