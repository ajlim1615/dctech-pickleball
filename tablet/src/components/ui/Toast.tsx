import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

let pushToast: (message: string) => void = () => {};

/** Shows a short message at the bottom of the screen. */
export function toast(message: string) {
  pushToast(message);
}

export function ToastHost() {
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    pushToast = (text) => {
      setMessage({ text, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 4000);
    };
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message.id}
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="rounded-[14px] bg-ink px-4 py-3 text-sm font-medium text-bg shadow-card"
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
