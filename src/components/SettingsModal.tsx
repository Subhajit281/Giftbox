import React, { useState } from 'react';
import type { ExperienceConfig } from '../content/giftData';
import { X, Save, Heart } from 'lucide-react';

interface SettingsModalProps {
  config: ExperienceConfig;
  onSave: (config: ExperienceConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<ExperienceConfig>({ ...config });

  const handleChange = (
    field: keyof ExperienceConfig,
    val: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-stone-900/35 backdrop-blur-md pointer-events-auto safe-top safe-bottom">
      <div className="glass-panel max-w-lg w-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] rounded-2xl sm:rounded-3xl p-5 sm:p-8 flex flex-col border-2 border-[#d4af37]/50 shadow-2xl relative bg-white/95 text-[#2e0b19]">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Confession Header */}
        <div className="text-center mb-5">
          <Heart className="w-7 h-7 mx-auto mb-2 text-[#c16e7d] fill-current animate-pulse" />

          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2e0b19] mb-1">
            A Little Confession
          </h2>

          <p className="font-serif-luxury text-sm sm:text-base text-stone-600 italic leading-relaxed">
            Some things are easier to write than to say...
          </p>

          <p className="text-xs text-stone-400 mt-2">
            From Subhajit, with a little courage and a lot of love.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-4 pr-1"
        >

          {/* Her Name */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#8a1c35] font-bold mb-1">
              Her Name
            </label>

            <input
              type="text"
              value={formData.recipientName}
              onChange={(e) =>
                handleChange('recipientName', e.target.value)
              }
              placeholder="The girl who makes your world a little brighter..."
              className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-[#d4af37]/50 text-[#2e0b19] text-sm focus:bg-white focus:outline-none focus:border-[#c59b27] font-semibold"
            />
          </div>

          {/* Your Name */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#8a1c35] font-bold mb-1">
              From
            </label>

            <input
              type="text"
              value={formData.creatorName}
              onChange={(e) =>
                handleChange('creatorName', e.target.value)
              }
              placeholder="Subhajit"
              className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-[#d4af37]/50 text-[#2e0b19] text-sm focus:bg-white focus:outline-none focus:border-[#c59b27] font-semibold"
            />
          </div>

          {/* Unlock Name */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#8a1c35] font-bold mb-1">
              The Answer Only She Knows
            </label>

            <p className="text-xs text-stone-500 mb-2 italic">
              What should she type to unlock the surprise?
            </p>

            <input
              type="text"
              value={formData.unlockName}
              onChange={(e) =>
                handleChange('unlockName', e.target.value)
              }
              placeholder="The name of the guy she loves..."
              className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-[#d4af37]/50 text-[#2e0b19] text-sm focus:bg-white focus:outline-none focus:border-[#c59b27] font-semibold"
            />
          </div>

          {/* Love Letter */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#8a1c35] font-bold mb-1">
              What Your Heart Wants To Say
            </label>

            <p className="text-xs text-stone-500 mb-2 italic">
              The words you might struggle to say when she's standing in front of you.
            </p>

            <textarea
              rows={7}
              value={formData.customLetterText}
              onChange={(e) =>
                handleChange('customLetterText', e.target.value)
              }
              placeholder={`Hey...

I've been wanting to tell you something for a while...

You became someone I started caring about more than I ever expected.

And somewhere between all our little conversations, your smile, your silly moments, and simply having you around...

I fell for you.

Maybe I don't always know how to say it,
but I hope you can feel it in everything I've made for you.

Happy 20th birthday. ❤️`}
              className="w-full px-3 py-3 rounded-xl bg-stone-50 border border-[#d4af37]/50 text-[#2e0b19] text-sm focus:bg-white focus:outline-none focus:border-[#c59b27] font-serif-luxury text-base leading-relaxed font-medium"
            />
          </div>

          {/* Voice Confession */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#8a1c35] font-bold mb-1">
              Something You'd Say Out Loud
            </label>

            <p className="text-xs text-stone-500 mb-2 italic">
              A short, natural message that sounds like you.
            </p>

            <textarea
              rows={3}
              value={formData.voiceNoteTranscript}
              onChange={(e) =>
                handleChange('voiceNoteTranscript', e.target.value)
              }
              placeholder="I don't know if I've ever said this properly... but you mean a lot to me. More than you probably realize."
              className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-[#d4af37]/50 text-[#2e0b19] text-sm focus:bg-white focus:outline-none focus:border-[#c59b27] font-serif-luxury text-base leading-relaxed font-medium"
            />
          </div>

          {/* WhatsApp Number */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#8a1c35] font-bold mb-1">
              Where The Confession Should Reach Her
            </label>

            <input
              type="text"
              value={formData.whatsappNumber}
              onChange={(e) =>
                handleChange('whatsappNumber', e.target.value)
              }
              placeholder="WhatsApp number with country code"
              className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-[#d4af37]/50 text-[#2e0b19] text-sm focus:bg-white focus:outline-none focus:border-[#c59b27] font-semibold"
            />
          </div>

          {/* WhatsApp Message */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#8a1c35] font-bold mb-1">
              Message After The Reveal
            </label>

            <p className="text-xs text-stone-500 mb-2 italic">
              The message she'll see when the final surprise opens.
            </p>

            <input
              type="text"
              value={formData.whatsappMessage}
              onChange={(e) =>
                handleChange('whatsappMessage', e.target.value)
              }
              placeholder="So... I finally said it. ❤️"
              className="w-full px-3 py-2.5 rounded-xl bg-stone-50 border border-[#d4af37]/50 text-[#2e0b19] text-sm focus:bg-white focus:outline-none focus:border-[#c59b27] font-semibold"
            />
          </div>

          {/* Save */}
          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl font-bold text-[#2e0b19] bg-gradient-to-r from-[#d4af37] to-[#f3e5ab] hover:brightness-105 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>Save My Confession</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};