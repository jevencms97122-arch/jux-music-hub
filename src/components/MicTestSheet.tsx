import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Mic, MicOff, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceAssistantSettings, isSpeechRecognitionSupported } from '@/hooks/useVoiceAssistant';
import { startVoskSession, type VoskSession } from '@/lib/voskEngine';

interface MicDevice {
  deviceId: string;
  label: string;
}

type TestState = 'idle' | 'listening' | 'detected';

/** L'app est chargée dans le wrapper Electron (exposé par preload.cjs) ? */
function isElectronApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
}

export default function MicTestSheet({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { micDeviceId, setMicDeviceId } = useVoiceAssistantSettings();
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [level, setLevel] = useState(0);
  const [testState, setTestState] = useState<TestState>('idle');
  const [transcript, setTranscript] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const voskSessionRef = useRef<VoskSession | null>(null);
  const detectedTimeoutRef = useRef<number | null>(null);
  const electron = isElectronApp();

  const stopAll = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    if (voskSessionRef.current) { try { voskSessionRef.current.stop(); } catch {} voskSessionRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (detectedTimeoutRef.current) { clearTimeout(detectedTimeoutRef.current); detectedTimeoutRef.current = null; }
    analyserRef.current = null;
    setLevel(0);
    setTestState('idle');
    setTranscript('');
  };

  // Lister les périphériques micro (labels visibles seulement après autorisation)
  const loadDevices = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const mics = list
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      setDevices(mics);
    } catch {}
  };

  useEffect(() => {
    if (!open) { stopAll(); return; }
    loadDevices();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startTest = async (deviceId: string | null) => {
    stopAll();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      setPermissionState('granted');
      loadDevices(); // labels dispo maintenant que l'autorisation est accordée

      // ── Jauge de niveau sonore ──
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setLevel(Math.min(100, Math.round((avg / 160) * 100)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // ── Test de détection vocale réel ──
      const markDetected = (text: string) => {
        setTranscript(text);
        setTestState('detected');
        if (detectedTimeoutRef.current) clearTimeout(detectedTimeoutRef.current);
        detectedTimeoutRef.current = window.setTimeout(() => setTestState('listening'), 2000);
      };

      if (electron) {
        // Dans Electron, webkitSpeechRecognition échoue toujours ("network") :
        // le service de Google n'est accessible qu'aux builds officiels de
        // Chrome. On teste avec le même moteur local (Vosk) que l'assistant.
        setTestState('listening');
        try {
          const session = await startVoskSession(
            stream,
            (text) => markDetected(text),
            (err) => console.error('[MicTestSheet] Erreur Vosk:', err),
            (partial) => setTranscript(partial),
          );
          voskSessionRef.current = session;
        } catch (err) {
          console.error('[MicTestSheet] Modèle de reconnaissance local indisponible', err);
        }
      } else if (isSpeechRecognitionSupported()) {
        setTestState('listening');
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SR();
        recognition.lang = 'fr-FR';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          const result = event.results[event.results.length - 1];
          const text = result[0]?.transcript || '';
          setTranscript(text);
          if (result.isFinal && text.trim()) markDetected(text);
        };
        recognition.onend = () => { if (streamRef.current) { try { recognition.start(); } catch {} } };
        try { recognition.start(); } catch {}
        recognitionRef.current = recognition;
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionState('denied');
      }
    }
  };

  const selectDevice = (id: string | null) => {
    setMicDeviceId(id);
    if (streamRef.current) startTest(id);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle>Microphone</SheetTitle>
        </SheetHeader>

        {!electron && !isSpeechRecognitionSupported() ? (
          <p className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Reconnaissance vocale non disponible sur ce navigateur.
          </p>
        ) : (
          <div className="space-y-5">
            {/* ── Choix du périphérique ── */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Périphérique</p>
              <div className="space-y-2">
                <button
                  onClick={() => selectDevice(null)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors',
                    micDeviceId === null ? 'bg-gradient-primary text-primary-foreground shadow-elegant-sm' : 'bg-secondary/50 text-foreground hover:bg-secondary/80'
                  )}
                >
                  Micro par défaut du système
                  {micDeviceId === null && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                </button>
                {devices.map((d) => (
                  <button
                    key={d.deviceId}
                    onClick={() => selectDevice(d.deviceId)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors',
                      micDeviceId === d.deviceId ? 'bg-gradient-primary text-primary-foreground shadow-elegant-sm' : 'bg-secondary/50 text-foreground hover:bg-secondary/80'
                    )}
                  >
                    <span className="truncate">{d.label}</span>
                    {micDeviceId === d.deviceId && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Test du micro ── */}
            <div className="rounded-2xl bg-card/60 p-4">
              {!streamRef.current ? (
                <button
                  onClick={() => startTest(micDeviceId)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-elegant-sm"
                >
                  <Mic className="h-4 w-4" />Tester le micro
                </button>
              ) : permissionState === 'denied' ? (
                <div className="flex items-center gap-3 text-sm text-red-400">
                  <MicOff className="h-5 w-5 shrink-0" />
                  Accès au micro refusé — autorise-le dans les réglages du navigateur.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Jauge de niveau */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Niveau sonore</span>
                      <span>{level > 8 ? 'Le micro capte du son ✓' : 'Parle pour tester…'}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/60">
                      <div
                        className={cn('h-full rounded-full transition-[width] duration-75', level > 60 ? 'bg-red-500' : level > 8 ? 'bg-green-500' : 'bg-primary/40')}
                        style={{ width: `${Math.max(3, level)}%` }}
                      />
                    </div>
                  </div>

                  {/* Détection vocale */}
                  <div className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3.5 py-3">
                    {testState === 'listening' ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {testState === 'detected' ? 'Voix détectée !' : 'En écoute — dis quelque chose'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {transcript || 'Ex. « Jux, pause »'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={stopAll}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary/70 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    <MicOff className="h-4 w-4" />Arrêter le test
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
