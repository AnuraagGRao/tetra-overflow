# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/google/home/aleks/Android/Sdk/tools/proguard/proguard-android.txt

-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve some attributes that may be required for reflection.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

-keep public class com.google.androidbrowserhelper.** { *; }
