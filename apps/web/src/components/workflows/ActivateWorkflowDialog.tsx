import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Clock, Play, Settings } from "lucide-react";
import type { WorkflowSummary } from "@/lib/workflows";

type ActivateWorkflowDialogProps = {
  workflow: WorkflowSummary | null;
  onClose: () => void;
  onSubmit: (mode: "now" | "reconfigure", newStartAt?: string, newInterval?: number) => void;
  pending: boolean;
};

export function ActivateWorkflowDialog({
  workflow,
  onClose,
  onSubmit,
  pending,
}: ActivateWorkflowDialogProps) {
  const [mode, setMode] = useState<"select" | "reconfigure">("select");
  const [newStartAt, setNewStartAt] = useState("");
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);

  const intervalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  const MAX_INTERVAL_SECONDS = 31536000; // 1 year in seconds

  const handleStartTimeQuickSelect = (offset: number) => {
    const now = new Date();
    const targetTime = new Date(now.getTime() + offset * 60000); // offset in minutes
    const localDateTimeString = targetTime.toISOString().slice(0, 16);
    setNewStartAt(localDateTimeString);
  };

  const handleClose = () => {
    setMode("select");
    onClose();
  };

  const handleRunNow = () => {
    onSubmit("now");
    handleClose();
  };

  const handleReconfigureSubmit = () => {
    if (!newStartAt) {
      toast.error("Please provide a start time");
      return;
    }
    if (intervalSeconds <= 0) {
      toast.error("Interval must be greater than 0");
      return;
    }
    if (intervalSeconds > MAX_INTERVAL_SECONDS) {
      toast.error("Interval cannot exceed 1 year (31536000 seconds)");
      return;
    }
    
    // Convert datetime-local (YYYY-MM-DDTHH:mm) to UTC ISO string
    const localDate = new Date(newStartAt);
    const utcIsoString = localDate.toISOString();
    
    onSubmit("reconfigure", utcIsoString, intervalSeconds);
    handleClose();
  };

  if (!workflow) return null;

  return (
    <Dialog open={!!workflow} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activate Scheduled Workflow
          </DialogTitle>
          <DialogDescription>
            Choose how to activate &ldquo;{workflow.name}&rdquo;
          </DialogDescription>
        </DialogHeader>

        {mode === "select" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-auto py-4 px-4 flex flex-col items-start hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-primary/50"
                onClick={handleRunNow}
                disabled={pending}
              >
                <div className="font-semibold flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Run Now
                </div>
                <div className="text-sm opacity-90 text-left">
                  Start executing immediately at the configured interval
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-auto py-4 px-4 flex flex-col items-start hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-primary/50"
                onClick={() => setMode("reconfigure")}
                disabled={pending}
              >
                <div className="font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Reconfigure Schedule
                </div>
                <div className="text-sm opacity-90 text-left">
                  Set a new start time and interval before activating
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start-at">Start At</Label>
              <Input
                id="start-at"
                type="datetime-local"
                value={newStartAt}
                onInput={(e) => setNewStartAt(e.currentTarget.value)}
                required
              />
              <div className="flex gap-1 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartTimeQuickSelect(0)}
                  className="text-xs h-7"
                >
                  Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartTimeQuickSelect(5)}
                  className="text-xs h-7"
                >
                  +5m
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartTimeQuickSelect(15)}
                  className="text-xs h-7"
                >
                  +15m
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartTimeQuickSelect(30)}
                  className="text-xs h-7"
                >
                  +30m
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Run Every</Label>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Days</Label>
                  <Input
                    type="number"
                    min="0"
                    value={days}
                    onChange={(e) => setDays(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, Math.min(23, Number(e.target.value))))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Sec</Label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={seconds}
                    onChange={(e) => setSeconds(Math.max(0, Math.min(59, Number(e.target.value))))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Total: {intervalSeconds} seconds</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("select")} disabled={pending}>
                Back
              </Button>
              <Button onClick={handleReconfigureSubmit} disabled={pending}>
                Activate
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
