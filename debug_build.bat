@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
cd android
gradlew assembleDebug --stacktrace --info > build_log.txt 2>&1
