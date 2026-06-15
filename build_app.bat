@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
echo Checking environment...
node -v
cd android
call gradlew.bat -v
echo Starting build with JAVA_HOME=%JAVA_HOME%
call gradlew.bat assembleDebug
echo Build finished.
