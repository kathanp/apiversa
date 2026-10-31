# Schedule — 9:00 AM and 9:00 PM Chicago, every day (configurable)

The operating system runs `scripts/scheduler.mjs` **every 15 minutes**. The script works out Chicago time itself (`America/Chicago`, daylight saving included) and starts a run only when a slot is due. That way the runs happen at Chicago time even if the computer is set to India time.

### Launch mode (first 28 days after the first stable release, and before it)

| Slot (Chicago)    | Run type         |
| ----------------- | ---------------- |
| 9:00 AM every day | `RELEASE` (falls back to `BUILD` when nothing is ready) |
| 9:00 PM every day | `HARDEN+RELEASE` (hardening, then a release attempt) |

Up to one stable release per track per day. **A version that is not ready shifts to the next slot by itself**: morning → evening → next morning. Nothing is released early to hit a time.

### Normal mode (after 28 days)

| Slot (Chicago)       | Run type  |
| -------------------- | --------- |
| 9:00 AM Monday       | `RELEASE` (falls back to `BUILD`) |
| 9:00 AM Tue–Sun      | `BUILD`   |
| 9:00 PM every day    | `HARDEN`  |

The scheduler asks the guard which mode each track is in (`node scripts/guard.mjs --launch-status`), so the switch after 28 days happens on its own.

### Changing the times

Edit `schedule.json` in the repo root:

```json
"schedule": {
  "timeZone": "America/Chicago",
  "slots": [
    { "name": "am", "time": "09:00", "type": "build" },
    { "name": "pm", "time": "21:00", "type": "harden" }
  ],
  "weeklyReleaseDay": "Mon",
  "windowMinutes": 120,
  "runHours": 3
}
```

Change `time` to move a slot, or add a third slot. The change applies at the next 15-minute check. `schedule.json` is not protected, so you can change it any time.

The launch length and daily cooldown are in `guard.config.json` → `launch` (`days: 28`, `cooldownDays: 1`). That file **is** protected, so an agent run cannot loosen the release rules. Set those values before the first release tag. A later change makes the release check refuse until it is part of a release you make yourself.

In India time these land around 7:30–8:30 PM and 7:30–8:30 AM, depending on US daylight saving.

**The computer must be awake, online, and logged in.** If it wakes up within 2 hours of a slot, the slot still runs. Later than that, the slot is recorded as missed in `.autopilot/slots/` and the next run reports it. `node scripts/scheduler.mjs --status` shows the last slots.

## macOS (launchd)

Create `~/Library/LaunchAgents/com.apiversa.autopilot.plist` (replace `/path/to/apiversa`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.apiversa.autopilot</string>
  <key>WorkingDirectory</key><string>/path/to/apiversa</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string><string>-lc</string>
    <string>node scripts/scheduler.mjs >> .autopilot/scheduler.out 2>&amp;1</string>
  </array>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
```

Load it: `launchctl load ~/Library/LaunchAgents/com.apiversa.autopilot.plist`

Keep the Mac awake at those times: System Settings → Battery → prevent sleep when the display is off, or `caffeinate -s` in a terminal.

## Windows (Task Scheduler)

```
schtasks /Create /TN "apiversa-autopilot" /SC MINUTE /MO 15 /TR "cmd /c cd /d C:\path\to\apiversa && node scripts\scheduler.mjs >> .autopilot\scheduler.out 2>&1"
```

In the task's properties, tick "Wake the computer to run this task".

## Linux (cron)

```
*/15 * * * * cd /path/to/apiversa && node scripts/scheduler.mjs >> .autopilot/scheduler.out 2>&1
```

## Agent command

The scheduler calls `cursor-agent -p "<prompt>"`. Check the flags on your install with `cursor-agent --help`. If your version needs extra flags to run commands without asking, set them:

```
export APIVERSA_AGENT_ARGS="-p --force"
```

Test without starting a run: `node scripts/scheduler.mjs --dry-run`.
