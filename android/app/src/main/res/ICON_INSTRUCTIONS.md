# Android TWA Launcher Icons

The launcher icons should be placed in the following directories:
- `mipmap-mdpi/` (48x48)
- `mipmap-hdpi/` (72x72)
- `mipmap-xhdpi/` (96x96)
- `mipmap-xxhdpi/` (144x144)
- `mipmap-xxxhdpi/` (192x192)

Files needed in each directory:
- `ic_launcher.png` - Square icon
- `ic_launcher_round.png` - Round icon (Android 7.1+)

## Generate Icons

Use one of these tools to generate all sizes:
1. Android Studio: Right-click `res` → New → Image Asset
2. Online: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
3. CLI: Use ImageMagick to resize your 512x512 source icon

Source icon should be based on `/public/icons/icon-512x512.png`
