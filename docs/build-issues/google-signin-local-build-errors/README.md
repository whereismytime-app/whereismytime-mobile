# Google Sign In Errors in Local .apk / iOS Builds

## Problem

When building .apk files or iOS bundles locally using `expo run:android` or `expo run:ios`, you may encounter Google Sign In authentication errors. This happens because the local build process uses the `.gitignore` file to determine which files to exclude from the build, which includes the Firebase configuration files:

- `google-services.json` (for Android)
- `GoogleService-Info.plist` (for iOS)

These files are essential for Google Sign In to work properly, but they get ignored during the local build process when Expo copies files to a temporary build directory.

## Root Cause

The issue occurs because:

1. `.gitignore` includes `google-services.json` and `GoogleService-Info.plist` to prevent committing sensitive Firebase config files to version control
2. When running local builds (`expo run:android` / `expo run:ios`), Expo uses `.gitignore` to filter files copied to the temp build directory
3. This results in the Firebase config files being excluded from the build, causing Google Sign In to fail

## Solution

Create a dedicated `.easignore` file that includes all patterns from `.gitignore` except for the Firebase config files. This allows EAS builds to include these files while still excluding them from git.

### Implementation

1. **Update package.json script**: Add or modify the `make-easignore` script to generate `.easignore` from `.gitignore` but exclude the Firebase config files:

```json
{
  "scripts": {
    "make-easignore": "cp .gitignore .easignore && sed -i '' '/google-services\\.json/d; /GoogleService-Info\\.plist/d' .easignore"
  }
}
```

2. **Run the script**: Execute `npm run make-easignore` to generate the `.easignore` file

3. **Verify the .easignore file**: Ensure it contains all `.gitignore` patterns except:
   - `google-services.json`
   - `GoogleService-Info.plist`

### Result

- **Local builds**: Now work correctly with Google Sign In since the config files are included
- **EAS builds**: Still work as expected (EAS uses `.easignore` if present, otherwise falls back to `.gitignore`)
- **Git**: Still ignores the sensitive config files as intended

## Testing

After implementing the solution:

1. Run `expo run:android` or `expo run:ios`
2. Test Google Sign In functionality in the built app
3. Verify that authentication works without errors

## Related Files

- `.gitignore` - Original ignore file
- `.easignore` - Generated ignore file for EAS builds
- `package.json` - Contains the `make-easignore` script
