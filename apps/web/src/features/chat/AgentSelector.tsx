import { Check, ChevronDown, MessageCircle } from 'lucide-react';
import { useAgentSelector } from './useAgentSelector';
export function AgentSelector(props: Parameters<typeof useAgentSelector>[0]) {
  const { agentId, disabled, compact } = props;
  const {
    open,
    triggerRef,
    menuRef,
    selected,
    selectorClassName,
    triggerClassName,
    handleToggle,
    avatarSize,
    catcherTabIndex,
    handleClose,
    handleMenuKeyDown,
    optionViews,
    error,
    reload,
  } = useAgentSelector(props);

  return (
    <div className={selectorClassName}>
      <button
        ref={triggerRef}
        className={triggerClassName}
        disabled={disabled}
        aria-label="切换研究 Agent"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span className="switcher-avatar">
          <MessageCircle size={avatarSize} />
        </span>
        <span className="switcher-body">
          <strong>{selected?.name || '选择数字员工'}</strong>
          {!compact && <span>{selected?.description}</span>}
        </span>
        {!compact && (
          <span className="switcher-badge">{selected ? `v${selected.version}` : ''}</span>
        )}
        <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <button
            className="agent-menu-catcher"
            tabIndex={catcherTabIndex}
            aria-label="关闭 Agent 菜单"
            onClick={handleClose}
          />
          <div
            ref={menuRef}
            className="agent-menu"
            role="menu"
            aria-label="选择研究 Agent"
            onKeyDown={handleMenuKeyDown}
          >
            {error && (
              <div className="agent-menu-error" role="alert">
                加载数字员工失败：{error}
                <button onClick={() => void reload()}>重试</button>
              </div>
            )}
            {!error && !optionViews.length && <p className="agent-menu-error">正在加载数字员工…</p>}
            {optionViews.map(({ option, checked, handleSelect }) => (
              <button
                key={option.id}
                role="menuitemradio"
                aria-checked={checked}
                onClick={handleSelect}
              >
                <span className="switcher-avatar">
                  <MessageCircle size={19} />
                </span>
                <span className="switcher-body">
                  <strong>{option.name}</strong>
                  <span>{option.description}</span>
                </span>
                {agentId === option.id && <Check size={15} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
