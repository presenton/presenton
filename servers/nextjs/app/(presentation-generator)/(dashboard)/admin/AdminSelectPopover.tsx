"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import styles from "./AdminSelectPopover.module.css";

type SelectOption = { value: string; label: string };

type AdminSelectPopoverProps = {
  id?: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  searchLabel?: string;
  emptyMessage?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
};

export default function AdminSelectPopover({
  id,
  label,
  value,
  options,
  onChange,
  searchable = false,
  searchLabel = "Search options",
  emptyMessage = "No options found.",
  placeholder = "Select an option",
  disabled = false,
  required = false,
  fullWidth = false,
}: AdminSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(value);
  const [listId, setListId] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder;
  const isDisabled = disabled || options.length === 0;
  const isOpen = open && !isDisabled;
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );

  useEffect(() => {
    if (isDisabled) setOpen(false);
  }, [isDisabled]);

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen && isDisabled) return;
    setOpen(nextOpen);
    if (nextOpen) {
      setQuery("");
      setHighlighted(value);
    }
  };

  const selectOption = (nextValue: string) => {
    if (isDisabled || !options.some((option) => option.value === nextValue)) return;
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-label={`${label}: ${selectedLabel}`}
          aria-haspopup="listbox"
          aria-controls={isOpen ? listId : undefined}
          aria-expanded={isOpen}
          aria-required={required || undefined}
          disabled={isDisabled}
          className={`${styles.trigger} ${fullWidth ? styles.fullWidth : ""}`}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              changeOpen(true);
            }
          }}
        >
          <span title={selectedLabel}>{selectedLabel}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={label}
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className={`${styles.content} ${searchable ? styles.searchable : ""}`}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          setListId(listRef.current?.id);
          (searchable ? searchRef.current : listRef.current)?.focus();
        }}
      >
        <Command
          label={searchable ? searchLabel : label}
          shouldFilter={false}
          value={highlighted}
          onValueChange={setHighlighted}
          loop
          className={styles.command}
          onKeyDown={(event) => {
            if (!searchable && event.key === " ") {
              event.preventDefault();
              selectOption(highlighted);
            }
          }}
        >
          {searchable && (
            <CommandInput
              ref={searchRef}
              placeholder={`${searchLabel}…`}
              value={query}
              onValueChange={setQuery}
              className={styles.searchInput}
            />
          )}
          <CommandList ref={listRef} label={label} className={styles.list}>
            <CommandEmpty className={styles.empty}>{emptyMessage}</CommandEmpty>
            <CommandGroup className={styles.group}>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => selectOption(option.value)}
                  className={styles.option}
                >
                  <span className={styles.optionLabel} title={option.label}>{option.label}</span>
                  <Check size={15} aria-hidden="true" className={value === option.value ? styles.check : styles.hiddenCheck} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
