import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface ChipOption {
  value: string;
  label: string;
}

interface MultiField {
  key: string;
  label: string;
  kind: 'multi';
  options: ChipOption[];
  selected: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}

interface SingleSelectField {
  key: string;
  label: string;
  kind: 'singleSelect';
  options: ChipOption[];
  value: string;
  onApply: (value: string) => void;
  onClear: () => void;
}

interface TextField {
  key: string;
  label: string;
  kind: 'text';
  value: string;
  onApply: (value: string) => void;
  onClear: () => void;
}

interface DateRangeField {
  key: string;
  label: string;
  kind: 'dateRange';
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
}

interface YesNoField {
  key: string;
  label: string;
  kind: 'yesNo';
  value: boolean | undefined;
  onApply: (value: boolean | undefined) => void;
}

export type FilterChipField = MultiField | SingleSelectField | TextField | DateRangeField | YesNoField;

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface Props {
  fields: FilterChipField[];
  onClearAll: () => void;
}

const formatDateLabel = (value: string) => {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const FilterChipBar: React.FC<Props> = ({ fields, onClearAll }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeField = useMemo(
    () => fields.find((field) => field.key === activeFieldKey) ?? null,
    [fields, activeFieldKey]
  );

  const closeAndCommitDrafts = () => {
    if (activeField?.kind === 'text' && draftText.trim() !== activeField.value.trim()) {
      activeField.onApply(draftText.trim());
    }
    if (activeField?.kind === 'dateRange' && (draftFrom !== activeField.from || draftTo !== activeField.to)) {
      activeField.onApply(draftFrom, draftTo);
    }
    setIsOpen(false);
    setActiveFieldKey(null);
    setPickerSearch('');
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        closeAndCommitDrafts();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAndCommitDrafts();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeField, draftText, draftFrom, draftTo]);

  const openField = (field: FilterChipField) => {
    setActiveFieldKey(field.key);
    setPickerSearch('');
    if (field.kind === 'text') {
      setDraftText(field.value);
    }
    if (field.kind === 'dateRange') {
      setDraftFrom(field.from);
      setDraftTo(field.to);
    }
  };

  const closePicker = () => {
    setIsOpen(false);
    setActiveFieldKey(null);
    setPickerSearch('');
  };

  const chips: Chip[] = useMemo(() => {
    const list: Chip[] = [];

    fields.forEach((field) => {
      if (field.kind === 'multi') {
        field.selected.forEach((value) => {
          const option = field.options.find((o) => o.value === value);
          list.push({
            key: `${field.key}-${value}`,
            label: `${field.label}: ${option?.label ?? value}`,
            onRemove: () => field.onRemove(value),
          });
        });
        return;
      }

      if (field.kind === 'singleSelect') {
        if (field.value) {
          const option = field.options.find((o) => o.value === field.value);
          list.push({
            key: field.key,
            label: `${field.label}: ${option?.label ?? field.value}`,
            onRemove: field.onClear,
          });
        }
        return;
      }

      if (field.kind === 'text') {
        if (field.value.trim().length > 0) {
          list.push({
            key: field.key,
            label: `${field.label}: ${field.value.trim()}`,
            onRemove: field.onClear,
          });
        }
        return;
      }

      if (field.kind === 'dateRange') {
        if (field.from || field.to) {
          const fromLabel = field.from ? formatDateLabel(field.from) : null;
          const toLabel = field.to ? formatDateLabel(field.to) : null;
          const label =
            fromLabel && toLabel
              ? `${field.label}: ${fromLabel} \u2013 ${toLabel}`
              : fromLabel
                ? `${field.label}: From ${fromLabel}`
                : `${field.label}: Until ${toLabel}`;
          list.push({ key: field.key, label, onRemove: field.onClear });
        }
        return;
      }

      if (field.kind === 'yesNo') {
        if (field.value !== undefined) {
          list.push({
            key: field.key,
            label: `${field.label}: ${field.value ? 'Yes' : 'No'}`,
            onRemove: () => field.onApply(undefined),
          });
        }
      }
    });

    return list;
  }, [fields]);

  const renderPickList = (
    options: ChipOption[],
    selected: string[],
    onPick: (value: string) => void
  ) => {
    const filtered = options.filter((option) =>
      option.label.toLowerCase().includes(pickerSearch.trim().toLowerCase())
    );
    const available = filtered.filter((option) => !selected.includes(option.value));

    return (
      <div className="w-64">
        <div className="relative mb-2">
          <input
            type="text"
            autoFocus
            value={pickerSearch}
            onChange={(event) => setPickerSearch(event.target.value)}
            placeholder="Search..."
            className="w-full rounded border border-gray-300 px-2 py-1 pr-7 text-sm focus:border-blue-500 focus:outline-none"
          />
          {pickerSearch ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setPickerSearch('')}
              aria-label="Clear filter search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
            >
              x
            </button>
          ) : null}
        </div>
        <ul className="max-h-48 overflow-y-auto">
          {available.length === 0 ? (
            <li className="px-2 py-1 text-sm text-gray-400">No matching options</li>
          ) : (
            available.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left text-sm hover:bg-blue-50"
                  onClick={() => onPick(option.value)}
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    );
  };

  const renderYesNoToggle = (
    current: boolean | undefined,
    onPick: (next: boolean | undefined) => void
  ) => (
    <div className="flex gap-2">
      <button
        type="button"
        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
          current === true ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => onPick(current === true ? undefined : true)}
      >
        Yes
      </button>
      <button
        type="button"
        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
          current === false ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => onPick(current === false ? undefined : false)}
      >
        No
      </button>
    </div>
  );

  const renderFieldEditor = () => {
    if (!activeField) {
      return null;
    }

    switch (activeField.kind) {
      case 'multi':
        return renderPickList(activeField.options, activeField.selected, (value) => {
          activeField.onAdd(value);
          closePicker();
        });
      case 'singleSelect':
        return renderPickList(activeField.options, activeField.value ? [activeField.value] : [], (value) => {
          activeField.onApply(value);
          closePicker();
        });
      case 'text':
        return (
          <div className="w-56 space-y-2">
            <input
              type="text"
              autoFocus
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  activeField.onApply(draftText.trim());
                  setIsOpen(false);
                  setActiveFieldKey(null);
                }
              }}
              placeholder={activeField.label}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                activeField.onApply(draftText.trim());
                setIsOpen(false);
                setActiveFieldKey(null);
              }}
            >
              Apply
            </button>
          </div>
        );
      case 'dateRange':
        return (
          <div className="w-64 space-y-2">
            <label className="block text-xs font-medium text-gray-500">
              From
              <input
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              To
              <input
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <button
              type="button"
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                activeField.onApply(draftFrom, draftTo);
                setIsOpen(false);
                setActiveFieldKey(null);
              }}
            >
              Apply
            </button>
          </div>
        );
      case 'yesNo':
        return renderYesNoToggle(activeField.value, (next) => {
          activeField.onApply(next);
          closePicker();
        });
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" ref={containerRef}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800 border border-blue-200"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter ${chip.label}`}
            className="text-blue-500 hover:text-blue-800"
          >
            {'\u00d7'}
          </button>
        </span>
      ))}

      <div className="relative">
        <button
          type="button"
          className="rounded-full border border-gray-300 px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50"
          onClick={() => {
            if (isOpen) {
              closeAndCommitDrafts();
            } else {
              setIsOpen(true);
              setActiveFieldKey(null);
            }
          }}
        >
          + Add filter
        </button>

        {isOpen ? (
          <div className="absolute left-0 top-full z-20 mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            {activeField === null ? (
              <ul className="w-48">
                {fields.map((field) => (
                  <li key={field.key}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-blue-50"
                      onClick={() => openField(field)}
                    >
                      {field.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                <button
                  type="button"
                  className="mb-2 text-xs font-medium text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setActiveFieldKey(null);
                    setPickerSearch('');
                  }}
                >
                  {'\u2190 Back'}
                </button>
                {renderFieldEditor()}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <button type="button" onClick={onClearAll} className="text-sm text-gray-500 underline hover:text-gray-700">
          Clear all
        </button>
      ) : null}
    </div>
  );
};

export default FilterChipBar;
