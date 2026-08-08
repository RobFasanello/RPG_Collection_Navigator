import { useEffect } from 'react';
import { useToast } from './ui/ToastProvider';
import { APP_MODE_FORBIDDEN_EVENT } from '../state/appMode';

export default function ApiErrorToastBridge() {
  const { toast } = useToast();

  useEffect(() => {
    const handleForbidden = () => {
      toast({
        title: 'Action blocked by current mode',
        description: 'Switch to Update or Administrator mode to make changes.',
        variant: 'warning',
      });
    };

    window.addEventListener(APP_MODE_FORBIDDEN_EVENT, handleForbidden);
    return () => window.removeEventListener(APP_MODE_FORBIDDEN_EVENT, handleForbidden);
  }, [toast]);

  return null;
}
