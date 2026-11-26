import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { matchesHubSearch, type NetworkHub } from '@semh/contracts';

export function HubSearchField({ hubs, value, loading, onChange, onSelect }: {
  hubs: readonly NetworkHub[];
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const query = value.trim();
  const suggestions = query ? hubs.filter(hub => matchesHubSearch(hub, query)).slice(0, 8) : [];
  const showSuggestions = open && query.length > 0;
  const expanded = showSuggestions && suggestions.length > 0;
  const activeIndex = expanded ? suggestions.findIndex(hub => hub.id === activeId) : -1;
  const active = suggestions[activeIndex];
  const focusedOption = active ? id + '-' + active.id : undefined;

  useEffect(() => {
    if (focusedOption) document.getElementById(focusedOption)?.scrollIntoView({ block: 'nearest' });
  }, [focusedOption]);

  function close() {
    setOpen(false);
    setActiveId(undefined);
  }

  function select(hubId: string) {
    close();
    onSelect(hubId);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && showSuggestions) {
      event.preventDefault();
      close();
    } else if (event.key === 'Enter') {
      if (active) {
        event.preventDefault();
        select(active.id);
      } else close();
    } else if (suggestions.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setOpen(true);
      const next = event.key === 'ArrowDown'
        ? (activeIndex + 1) % suggestions.length
        : activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1;
      setActiveId(suggestions[next]?.id);
    }
  }

  return <div className="hub-query">
    <label htmlFor={id}>Tên hoặc mã Hub</label>
    <input id={id} name="q" type="search" role="combobox" placeholder="Ví dụ Ký túc xá Khu B" maxLength={120}
      value={value} autoComplete="off" aria-autocomplete="list" aria-expanded={expanded}
      aria-controls={expanded ? id + '-suggestions' : undefined} aria-activedescendant={focusedOption}
      onFocus={() => setOpen(true)} onBlur={close} onKeyDown={handleKey}
      onChange={event => {
        onChange(event.target.value);
        setActiveId(undefined);
        setOpen(true);
      }} />
    {expanded ? <ul className="hub-suggestions" id={id + '-suggestions'} role="listbox" aria-label="Gợi ý Hub">
      {suggestions.map(hub => <li key={hub.id} id={id + '-' + hub.id} role="option" aria-selected={hub.id === activeId}
        onPointerDown={event => event.preventDefault()} onClick={() => select(hub.id)}>
        <strong>{hub.name}</strong>
        <small>{hub.code}</small>
      </li>)}
    </ul> : showSuggestions && <p className="hub-suggestions hub-suggestion-status" role="status">
      {loading ? 'Đang tải Hub…' : 'Không tìm thấy Hub phù hợp.'}
    </p>}
  </div>;
}
