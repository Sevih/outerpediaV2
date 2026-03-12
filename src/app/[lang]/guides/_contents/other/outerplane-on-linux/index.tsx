'use client'

import GuideTemplate from '@/app/components/guides/GuideTemplate'

/* ── Helpers ─────────────────────────────────────────────── */

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-200">
      <code>{children}</code>
    </pre>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={`step-${n}`} className="space-y-3">
      <h2 className="text-xl font-semibold">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white mr-2">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-zinc-300 text-sm">{children}</div>
    </section>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      {children}
    </div>
  )
}

/* ── Component ───────────────────────────────────────────── */

export default function OuterplaneOnLinuxGuide() {
  return (
    <GuideTemplate
      title="Outerplane on Linux (2026)"
      disclaimer="Important: Waydroid is not officially supported by the Outerplane developers. This is a community guide — use at your own risk. Google Play Games (the only officially supported PC platform) is not available on Linux."
    >
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-zinc-800 bg-linear-to-br from-zinc-900/60 via-zinc-900 to-zinc-900/60 p-6 md:p-8 mb-8">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-green-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight after:hidden">
            Outerplane on <span className="text-green-400">Linux</span>
          </h2>
          <p className="text-sm text-zinc-300 mt-2">
            Waydroid setup for running Outerplane on Linux with Wayland.
            Includes all 2026 fixes for translation, Google cert, network sync, and anti-cheat.
          </p>
        </div>
      </section>

      {/* Grid content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">

          {/* Prerequisites */}
          <Step n={1} title="Prerequisites">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Wayland compositor</strong> — GNOME / Plasma 6 / Sway</li>
              <li>X11: run a nested Wayland session via <code className="text-green-400">cage</code></li>
              <li>Kernel modules: <code className="text-green-400">binder_linux</code> + <code className="text-green-400">ashmem_linux</code> (via <code>linux-zen</code> or <code>waydroid-dkms</code>)</li>
            </ul>
          </Step>

          {/* Install Waydroid */}
          <Step n={2} title="Install Waydroid">
            <p className="font-semibold text-zinc-200">Arch / Manjaro:</p>
            <Code>{`sudo pacman -S waydroid lzip python-pip sqlite3 git --needed`}</Code>
            <p className="font-semibold text-zinc-200 mt-2">Ubuntu / Debian:</p>
            <Code>{`sudo apt install curl ca-certificates -y\ncurl -s https://repo.waydro.id | sudo bash\nsudo apt install waydroid -y`}</Code>
            <p className="font-semibold text-zinc-200 mt-2">Fedora:</p>
            <Code>{`sudo dnf install waydroid`}</Code>
            <p className="text-xs text-zinc-400 mt-2">
              See <a href="https://docs.waydro.id/usage/install-on-desktops" target="_blank" rel="noopener noreferrer" className="underline text-blue-400">Waydroid docs</a> for other distros.
            </p>
          </Step>

          {/* Init with GAPPS */}
          <Step n={3} title="Init with GAPPS">
            <Code>{`sudo waydroid init -s GAPPS\nsudo systemctl enable --now waydroid-container`}</Code>
          </Step>

          {/* Translation Layer */}
          <Step n={4} title="Translation Layer Setup">
            <Code>{`git clone https://github.com/casualsnek/waydroid_script\ncd waydroid_script && python3 -m venv venv\nvenv/bin/pip install -r requirements.txt`}</Code>
            <p className="font-semibold text-zinc-200 mt-2">Install libndk (2026 Standard):</p>
            <Code>{`sudo venv/bin/python3 main.py install libndk`}</Code>
          </Step>

          {/* Google Certification */}
          <Step n={5} title="Google Certification Fix">
            <p>Get your Android ID:</p>
            <Code>{`sudo waydroid shell -- sh -c "sqlite3 /data/data/com.google.android.gsf/databases/gservices.db \\\n  'select value from main where name=\\"android_id\\";'"`}</Code>
            <p>
              Register at{' '}
              <a
                href="https://www.google.com/android/uncertified/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                google.com/android/uncertified
              </a>
            </p>
            <Warning>
              <p>Wait <strong>20 min to 24 hours</strong> for certification to propagate.</p>
            </Warning>
          </Step>

          {/* Network Sync */}
          <Step n={6} title='Network Sync Fix (2026 "Ack Patch")'>
            <Code>{`sudo waydroid shell <<EOF\nip link set eth0 mtu 1400\nsetprop persist.waydroid.fake_wifi '*'\nsettings put global private_dns_mode off\nexit\nEOF`}</Code>
          </Step>

          {/* GPU Passthrough */}
          <Step n={7} title="GPU Passthrough">
            <Code>{`waydroid prop set ro.hardware.egl mesa\nwaydroid prop set ro.hardware.gralloc gbm`}</Code>
          </Step>

          {/* Anti-Cheat */}
          <Step n={8} title="Anti-Cheat (Magisk)">
            <Code>{`sudo venv/bin/python3 main.py install magisk`}</Code>
            <p>Then in Magisk:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Enable <strong>Zygisk</strong></li>
              <li>Add Outerplane to <strong>DenyList</strong></li>
            </ul>
          </Step>

          {/* Splash Screen Bypass */}
          <Step n={9} title="2026 Splash-Screen Bypass">
            <Warning>
              <p>If stuck on the icon:</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Set system date to <strong>Oct 2025</strong></li>
                <li>Launch the game</li>
                <li>After &quot;Tap to Start,&quot; restore the correct date</li>
              </ol>
            </Warning>
          </Step>

          {/* Play Store Fix */}
          <Step n={10} title="Play Store / Final Launch Fix">
            <Code>{`sudo waydroid shell rm -rf /data/data/com.android.vending\nwaydroid session stop\nwaydroid show-full-ui`}</Code>
          </Step>

          {/* Black Screen */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Troubleshooting: Black Screen</h2>
            <div className="space-y-3 text-zinc-300 text-sm">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                <div>
                  <p className="font-semibold text-zinc-200">High CPU (25%+)</p>
                  <p>Reinstall libndk translation layer.</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-200">NVIDIA GPU</p>
                  <Code>{`waydroid prop set ro.hardware.egl swiftshader`}</Code>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 space-y-4 h-max">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <h4 className="font-semibold mb-2 after:hidden">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#step-1" className="text-blue-400 hover:underline">Prerequisites</a></li>
              <li><a href="#step-2" className="text-blue-400 hover:underline">Install Waydroid</a></li>
              <li><a href="#step-4" className="text-blue-400 hover:underline">Translation Layer</a></li>
              <li><a href="#step-5" className="text-blue-400 hover:underline">Google Cert Fix</a></li>
              <li><a href="#step-8" className="text-blue-400 hover:underline">Anti-Cheat</a></li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <h4 className="font-semibold mb-2 after:hidden">Requirements</h4>
            <ul className="text-sm space-y-1 text-amber-100">
              <li>Wayland compositor</li>
              <li>binder_linux + ashmem_linux</li>
              <li>AMD GPU recommended</li>
            </ul>
          </div>

          <Warning>
            <p className="font-semibold">Disclaimer</p>
            <p className="mt-1 text-xs">Waydroid is not officially supported. This guide was tested on Arch Linux with a full AMD hardware stack. NVIDIA GPUs require software rendering (swiftshader) which may result in poor performance. Community-maintained.</p>
          </Warning>
        </aside>
      </div>
    </GuideTemplate>
  )
}
