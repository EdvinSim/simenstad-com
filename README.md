# Simenstad.com

To test locally, run this in PowerShell from the project folder:

```powershell
cd C:\dev\simenstad.com; py -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

If `py` does not work, use:

```powershell
cd C:\dev\simenstad.com; python -m http.server 8000
```

For IntelliJ, create a Shell Script run config with the script path `C:\dev\simenstad.com\run-local-server.bat` and working directory `C:\dev\simenstad.com`.
