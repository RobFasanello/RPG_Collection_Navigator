import React from 'react';
import ComboMultiSelect from './ComboMultiSelect';

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
  return (
    <ComboMultiSelect
      options={options}
      selected={selected}
      onChange={onChange}
      placeholder={placeholder || 'Select options'}
      className={className || 'w-full'}
    />
  );
};

export default MultiSelect;
