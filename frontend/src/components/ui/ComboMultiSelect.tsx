import React, { useEffect, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

const ComboMultiSelect: React.FC<Props> = ({ options, selected, onChange, placeholder = 'Select...', className }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  const selectAllChecked = filtered.length > 0 && filtered.every((o) => selected.includes(o.value));

  const toggleOption = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const toggleSelectAll = () => {
    if (selectAllChecked) {
      const toRemove = new Set(filtered.map((f) => f.value));
      onChange(selected.filter((s) => !toRemove.has(s)));
    } else {
      const combined = Array.from(new Set([...selected, ...filtered.map((f) => f.value)]));
      onChange(combined);
    }
  };

  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);

  return (
    <div className={className ?? 'inline-block'} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-w-[10rem] max-w-full text-left border rounded-md p-2 items-center justify-between"
      >
        <div className="truncate">
          {selectedLabels.length === 0 ? (
            <span className="text-gray-500">{placeholder}</span>
          ) : selectedLabels.length > 2 ? (
            <span>{selectedLabels.length} selected</span>
          ) : (
            <span>{selectedLabels.join(', ')}</span>
          )}
        </div>
        <svg className={`w-4 h-4 ml-2 transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="mt-1 z-50 bg-white border rounded-md shadow-lg min-w-full absolute max-h-64 overflow-auto">
          <div className="p-2">
            <input
              className="w-full border rounded-md p-2 mb-2"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <label className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={selectAllChecked} onChange={toggleSelectAll} />
              <span className="text-sm">Select all</span>
            </label>

            <div className="space-y-1">
              {filtered.length === 0 && <div className="text-sm text-gray-500 p-2">No options</div>}
              {filtered.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggleOption(opt.value)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComboMultiSelect;
