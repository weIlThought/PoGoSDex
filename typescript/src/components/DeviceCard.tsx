import { CheckCircle2, AlertCircle, Smartphone, Tablet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Device } from "@/data/devices";

interface DeviceCardProps {
  device: Device;
  onClick: () => void;
}

export const DeviceCard = ({ device, onClick }: DeviceCardProps) => {
  const TypeIcon = device.type === "phone" ? Smartphone : Tablet;
  const CompatibilityIcon = device.compatibility === "full" ? CheckCircle2 : AlertCircle;
  
  return (
    <Card
      className="p-6 cursor-pointer bg-gradient-card border-border hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-muted">
          <TypeIcon className="h-6 w-6 text-primary" />
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg text-foreground">{device.brand}</h3>
            <CompatibilityIcon 
              className={`h-5 w-5 ${device.compatibility === 'full' ? 'text-primary' : 'text-secondary'}`} 
            />
          </div>
          
          <p className="text-muted-foreground">{device.model}</p>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
              {device.osVersion}
            </span>
            <span className="text-muted-foreground capitalize">
              {device.type}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
