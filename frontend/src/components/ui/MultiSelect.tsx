import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, placeholder, className }) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, (o) => o.value);
    onChange(values);
  };

  return (
    <div className={className}>
      <select
        multiple
        value={selected}
        onChange={handleChange}
        className="w-full border rounded-md p-2"
        aria-label={placeholder || 'Select options'}
      >
        {options.length === 0 && <option disabled>Loading...</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MultiSelect;
