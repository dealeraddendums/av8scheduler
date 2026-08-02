import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Camera, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { apiPost } from '@av8/api';
import type { GaugeReading, LastReading } from '@av8/api';

interface GaugeCaptureProps {
  onResult: (hobbs: number | null, tach: number | null) => void;
  /** Previous flight's readings — used as realistic placeholder examples. */
  lastReading?: LastReading | null;
}

type ReadStatus = 'idle' | 'reading' | 'error' | 'done';

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      if (comma === -1) {
        reject(new Error('Unexpected file reader output'));
        return;
      }
      const header = result.slice(0, comma);
      const data = result.slice(comma + 1);
      const m = header.match(/data:([^;]+);/);
      resolve({ data, mediaType: m?.[1] ?? file.type ?? 'image/jpeg' });
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

const BORDER = '1px solid rgba(78, 81, 102, 0.2)';
const RADIUS = '0.625rem';

function parseNum(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function GaugeCapture({ onResult, lastReading }: GaugeCaptureProps) {
  const hobbsExample =
    lastReading && lastReading.hobbs_end > 0 ? `last ${lastReading.hobbs_end.toFixed(1)}` : 'e.g. 456.3';
  const tachExample =
    lastReading && lastReading.tach_end > 0 ? `last ${lastReading.tach_end.toFixed(1)}` : 'e.g. 63.1';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode A — AI read
  const [aiStatus, setAiStatus] = useState<ReadStatus>('idle');
  const [aiHobbs, setAiHobbs] = useState<number | null>(null);
  const [aiTach, setAiTach] = useState<number | null>(null);
  const [aiConfidence, setAiConfidence] = useState<'high' | 'low' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Mode B — Manual
  const [manHobbs, setManHobbs] = useState<number | null>(null);
  const [manTach, setManTach] = useState<number | null>(null);

  const handleFile = async (file: File) => {
    setAiStatus('reading');
    setAiError(null);
    setAiConfidence(null);
    try {
      const { data, mediaType } = await fileToBase64(file);
      const reading = await apiPost<GaugeReading>('/read-gauges', {
        image_base64: data,
        media_type: mediaType,
      });
      setAiHobbs(reading.hobbs !== null ? Number(reading.hobbs) : null);
      setAiTach(reading.tach !== null ? Number(reading.tach) : null);
      setAiConfidence(reading.confidence);
      setAiStatus('done');
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : 'Failed to read gauges');
    }
  };

  const lowOrError = aiStatus === 'error' || (aiStatus === 'done' && aiConfidence === 'low');

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Mode A — AI */}
      <div
        className="bg-white p-4 space-y-3"
        style={{ border: BORDER, borderRadius: RADIUS }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-[#4E5166]">
            <Sparkles className="w-4 h-4" />
            AI gauge reading
          </div>
          {aiStatus === 'done' && aiConfidence && (
            <Badge
              variant="outline"
              className={
                aiConfidence === 'high'
                  ? 'bg-green-50 text-green-700 border-green-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }
            >
              {aiConfidence}
            </Badge>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 gap-2 border-[rgba(78,81,102,0.2)] text-[#4E5166] hover:bg-[#f8f8f8]"
          onClick={() => fileInputRef.current?.click()}
          disabled={aiStatus === 'reading'}
        >
          {aiStatus === 'reading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Reading gauges…
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              {aiStatus === 'done' ? 'Retake photo' : 'Take or upload photo'}
            </>
          )}
        </Button>

        {lowOrError && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-300 text-amber-800 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {aiError
                ? `AI couldn't read — ${aiError}. Use manual entry below or retake.`
                : "AI couldn't read clearly — please verify or use manual entry."}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ai-hobbs">Hobbs end</Label>
            <Input
              id="ai-hobbs"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="—"
              value={aiHobbs ?? ''}
              onChange={(e) => setAiHobbs(parseNum(e.target.value))}
              disabled={aiStatus === 'reading'}
            />
          </div>
          <div>
            <Label htmlFor="ai-tach">Tach end</Label>
            <Input
              id="ai-tach"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="—"
              value={aiTach ?? ''}
              onChange={(e) => setAiTach(parseNum(e.target.value))}
              disabled={aiStatus === 'reading'}
            />
          </div>
        </div>

        <Button
          type="button"
          className="w-full bg-[#4E5166] hover:bg-[#3e4156] text-white"
          disabled={aiStatus === 'reading' || aiHobbs === null || aiTach === null}
          onClick={() => onResult(aiHobbs, aiTach)}
        >
          Use these values
        </Button>
      </div>

      {/* Mode B — Manual */}
      <div
        className="bg-white p-4 space-y-3"
        style={{ border: BORDER, borderRadius: RADIUS }}
      >
        <div className="text-sm text-[#4E5166]">Manual entry</div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="man-hobbs">Ending Hobbs</Label>
            <Input
              id="man-hobbs"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={hobbsExample}
              value={manHobbs ?? ''}
              onChange={(e) => setManHobbs(parseNum(e.target.value))}
              autoFocus={lowOrError}
            />
          </div>
          <div>
            <Label htmlFor="man-tach">Ending Tach</Label>
            <Input
              id="man-tach"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={tachExample}
              value={manTach ?? ''}
              onChange={(e) => setManTach(parseNum(e.target.value))}
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full border-[rgba(78,81,102,0.2)] text-[#4E5166] hover:bg-[#f8f8f8]"
          disabled={manHobbs === null || manTach === null}
          onClick={() => onResult(manHobbs, manTach)}
        >
          Enter manually
        </Button>

        <p className="text-xs text-[#747274] leading-snug">
          Type the gauge readings if you skipped the photo or the AI couldn't read.
        </p>
      </div>
    </div>
  );
}
