import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  WalletCards
} from "lucide-react";
import { EmptyState, Field, Modal, PageHeader, ToggleRow } from "../components/ui";
import { useDataStore } from "../store/DataStore";
import { uid } from "../lib/id";
import { parseYuanToCents, formatCents, centsToYuanInput, formatDiscountPercent } from "../lib/money";
import { calcRechargeCredit } from "../lib/billing";
import type { Member } from "../types";

export function MemberPage() {
  const { data, upsertMember, deleteMember } = useDataStore();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ member: Member; isNew: boolean } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  if (!data) return null;

  const filtered = data.members.filter((member) => {
    const text = `${member.name} ${member.phone} ${member.note}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });
  const detailMember = data.members.find((member) => member.id === detailId) ?? null;
  const selectedEditor = editor?.member ?? null;

  return (
    <div className="page">
      <PageHeader
        title="会员管理"
        subtitle={`${data.members.length} 位会员 · 累计储值 ${formatCents(totalStored(data))}`}
        actions={
          <button
            className="button primary"
            type="button"
            onClick={() =>
              setEditor({
                member: {
                  id: uid("member"),
                  name: "",
                  phone: "",
                  note: "",
                  balanceCents: 0,
                  defaultDiscountPercent: 100,
                  defaultRechargeBonusPercent: 0,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                },
                isNew: true
              })
            }
          >
            <Plus size={19} />
            添加会员
          </button>
        }
      />

      <div className="toolbar-row">
        <label className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名、电话或备注" />
        </label>
        <span className="toolbar-stat">全部余额合计 {formatCents(totalStored(data))}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users size={36} />} title="还没有会员" detail="添加会员后可在结账时使用储值与折扣" />
      ) : (
        <div className="member-grid">
          {filtered.map((member) => (
            <button
              type="button"
              className="member-card"
              key={member.id}
              onClick={() => setDetailId(member.id)}
            >
              <span className="member-avatar">{member.name.slice(0, 1) || "会"}</span>
              <span className="member-main">
                <strong>{member.name}</strong>
                <small>{member.phone || "未留电话"}</small>
              </span>
              <span className="member-meta">
                <b>{formatCents(member.balanceCents)}</b>
                <small>{formatDiscountPercent(member.defaultDiscountPercent)}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      <MemberEditor
        key={selectedEditor?.id ?? "empty"}
        editor={editor}
        onClose={() => setEditor(null)}
        onSave={(member) => {
          upsertMember(member);
          setEditor(null);
          setDetailId(member.id);
        }}
      />

      <MemberDetail
        member={detailMember}
        onClose={() => setDetailId(null)}
        onEdit={(member) => {
          setDetailId(null);
          setEditor({ member, isNew: false });
        }}
        onDelete={(member) => {
          if (member.balanceCents !== 0) {
            window.alert("余额不为 0 时不能删除，请先清空或调整余额。");
            return;
          }
          if (window.confirm(`确定删除会员“${member.name}”吗？`)) {
            deleteMember(member.id);
            setDetailId(null);
          }
        }}
        onShowRecharge={() => setShowRecharge(true)}
        onShowAdjust={() => setShowAdjust(true)}
        showRecharge={showRecharge}
        showAdjust={showAdjust}
        onCloseRecharge={() => setShowRecharge(false)}
        onCloseAdjust={() => setShowAdjust(false)}
      />
    </div>
  );
}

function totalStored(data: { members: Member[] }): number {
  return data.members.reduce((sum, member) => sum + member.balanceCents, 0);
}

function MemberEditor({
  editor,
  onClose,
  onSave
}: {
  editor: { member: Member; isNew: boolean } | null;
  onClose: () => void;
  onSave: (member: Member) => void;
}) {
  const member = editor?.member;
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [note, setNote] = useState(member?.note ?? "");
  const [discount, setDiscount] = useState(String(member?.defaultDiscountPercent ?? 100));
  const [bonus, setBonus] = useState(String(member?.defaultRechargeBonusPercent ?? 0));
  const [balanceText, setBalanceText] = useState(member ? centsToYuanInput(member.balanceCents) : "0");
  if (!editor || !member) return null;
  const discountNumber = Math.max(0, Math.min(100, Number(discount) || 100));
  const bonusNumber = Math.max(0, Math.min(1000, Number(bonus) || 0));

  return (
    <Modal open={Boolean(editor)} title={editor.isNew ? "添加会员" : "编辑会员"} onClose={onClose}>
      <div className="form-grid">
        <Field label="会员姓名">
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="电话">
          <input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="备注">
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Field label="初始余额（元）" hint="新增会员可录入；编辑时也可修正余额">
          <input inputMode="decimal" value={balanceText} onChange={(event) => setBalanceText(event.target.value)} />
        </Field>
        <Field label="消费折扣（%）" hint="100 为无折扣，90 即按九折收款">
          <input type="number" min="0" max="100" value={discount} onChange={(event) => setDiscount(event.target.value)} />
        </Field>
        <Field label="充值赠送（%）" hint="充值时按实收金额自动赠送，可当场修改">
          <input type="number" min="0" max="1000" value={bonus} onChange={(event) => setBonus(event.target.value)} />
        </Field>
      </div>
      <div className="modal-actions">
        <button className="button ghost" type="button" onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          type="button"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              ...member,
              name: name.trim(),
              phone: phone.trim(),
              note: note.trim(),
              balanceCents: editor.isNew
                ? Math.max(0, parseYuanToCents(balanceText))
                : parseYuanToCents(balanceText),
              defaultDiscountPercent: discountNumber,
              defaultRechargeBonusPercent: bonusNumber,
              updatedAt: Date.now()
            })
          }
        >
          保存
        </button>
      </div>
    </Modal>
  );
}

function MemberDetail({
  member,
  onClose,
  onEdit,
  onDelete,
  onShowRecharge,
  onShowAdjust,
  showRecharge,
  showAdjust,
  onCloseRecharge,
  onCloseAdjust
}: {
  member: Member | null;
  onClose: () => void;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  onShowRecharge: () => void;
  onShowAdjust: () => void;
  showRecharge: boolean;
  showAdjust: boolean;
  onCloseRecharge: () => void;
  onCloseAdjust: () => void;
}) {
  const { data, rechargeMember, adjustMemberBalance } = useDataStore();
  const events = useMemo(() => {
    if (!member || !data) return [];
    const items = [
      ...data.rechargeRecords
        .filter((record) => record.memberId === member.id)
        .map((record) => ({ id: record.id, date: record.createdAt, title: `充值 ${formatCents(record.payCents)}`, detail: `到账 ${formatCents(record.creditedCents)}，赠送 ${formatCents(record.giftCents)}${record.note ? ` · ${record.note}` : ""}`, delta: record.creditedCents })),
      ...data.balanceAdjustmentRecords
        .filter((record) => record.memberId === member.id)
        .map((record) => ({ id: record.id, date: record.createdAt, title: `调整余额 ${formatCents(record.deltaCents, false)}`, detail: record.note || "手动调整", delta: record.deltaCents })),
      ...data.paymentRecords
        .filter((record) => record.memberId === member.id)
        .map((record) => ({ id: record.id, date: record.paidAt, title: `消费 ${formatCents(record.payableCents)}`, detail: `${record.tableName}${record.balanceUsedCents ? ` · 储值 ${formatCents(record.balanceUsedCents)}` : ""}`, delta: -record.balanceUsedCents }))
    ];
    return items.sort((a, b) => b.date - a.date).slice(0, 12);
  }, [member, data]);

  if (!member) return null;
  return (
    <>
      <Modal open title="会员详情" onClose={onClose} wide>
        <div className="member-detail">
          <div className="member-summary-block">
            <span className="member-avatar large">{member.name.slice(0, 1)}</span>
            <div>
              <h3>{member.name}</h3>
              <p>{member.phone || "未留电话"}</p>
              {member.note ? <p className="muted">{member.note}</p> : null}
            </div>
            <div className="balance-card">
              <WalletCards size={22} />
              <span>储值余额</span>
              <strong>{formatCents(member.balanceCents)}</strong>
            </div>
          </div>
          <div className="metric-strip">
            <div>
              <span>消费折扣</span>
              <strong>{formatDiscountPercent(member.defaultDiscountPercent)}</strong>
            </div>
            <div>
              <span>充值赠送</span>
              <strong>{member.defaultRechargeBonusPercent}%</strong>
            </div>
          </div>
          <div className="modal-actions member-actions">
            <button className="button primary" type="button" onClick={onShowRecharge}>
              <ArrowDownToLine size={18} />
              充值
            </button>
            <button className="button" type="button" onClick={onShowAdjust}>
              <ArrowUpFromLine size={18} />
              调整余额
            </button>
            <button className="button" type="button" onClick={() => onEdit(member)}>
              <Pencil size={18} />
              编辑资料
            </button>
            <button className="button danger" type="button" onClick={() => onDelete(member)}>
              <Trash2 size={18} />
              删除
            </button>
          </div>
          <div className="history-title">
            <strong>余额与消费记录</strong>
          </div>
          {events.length === 0 ? (
            <div className="empty-inline">暂无记录</div>
          ) : (
            <ul className="event-list">
              {events.map((event) => (
                <li key={event.id}>
                  <span>
                    <strong>{event.title}</strong>
                    <small>{new Date(event.date).toLocaleString("zh-CN", { hour12: false })}</small>
                  </span>
                  <p>{event.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
      <RechargeModal member={member} open={showRecharge} onClose={onCloseRecharge} onConfirm={rechargeMember} />
      <AdjustModal member={member} open={showAdjust} onClose={onCloseAdjust} onConfirm={adjustMemberBalance} />
    </>
  );
}

function RechargeModal({
  member,
  open,
  onClose,
  onConfirm
}: {
  member: Member;
  open: boolean;
  onClose: () => void;
  onConfirm: (memberId: string, payCents: number, creditedCents?: number, note?: string) => void;
}) {
  const [payText, setPayText] = useState("");
  const [creditText, setCreditText] = useState("");
  const [note, setNote] = useState("");
  const payCents = parseYuanToCents(payText);
  const auto = calcRechargeCredit(payCents, member.defaultRechargeBonusPercent);
  const creditedCents = creditText.trim() ? parseYuanToCents(creditText) : auto.creditedCents;

  return (
    <Modal open={open} title={`为 ${member.name} 充值`} onClose={onClose}>
      <div className="form-grid">
        <Field label="实收金额（元）">
          <input
            inputMode="decimal"
            value={payText}
            onChange={(event) => {
              setPayText(event.target.value);
              setCreditText("");
            }}
            placeholder="0.00"
          />
        </Field>
        <Field label="到账金额（元）" hint={`默认按赠送 ${member.defaultRechargeBonusPercent}% 计算，可修改`}>
          <input
            inputMode="decimal"
            value={creditedCents ? centsToYuanInput(creditedCents) : creditText}
            onChange={(event) => setCreditText(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="备注">
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
      {creditedCents > payCents ? (
        <div className="calculation-note">本次赠送 {formatCents(creditedCents - payCents)}</div>
      ) : null}
      <div className="modal-actions">
        <button className="button ghost" type="button" onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          type="button"
          disabled={payCents <= 0 || creditedCents < payCents}
          onClick={() => {
            onConfirm(member.id, payCents, creditedCents, note.trim());
            onClose();
          }}
        >
          确认充值
        </button>
      </div>
    </Modal>
  );
}

function AdjustModal({
  member,
  open,
  onClose,
  onConfirm
}: {
  member: Member;
  open: boolean;
  onClose: () => void;
  onConfirm: (memberId: string, deltaCents: number, note: string) => void;
}) {
  const [deltaText, setDeltaText] = useState("");
  const [note, setNote] = useState("");
  const deltaCents = parseYuanToCents(deltaText);

  return (
    <Modal open={open} title={`调整 ${member.name} 余额`} onClose={onClose}>
      <div className="form-grid">
        <Field label="变动金额（元）" hint="输入负数表示扣减">
          <input inputMode="decimal" value={deltaText} onChange={(event) => setDeltaText(event.target.value)} placeholder="0.00" />
        </Field>
        <Field label="原因">
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
      {deltaCents !== 0 && member.balanceCents + deltaCents < 0 ? (
        <div className="calculation-note error">余额不能为负数，请检查扣减金额</div>
      ) : null}
      <div className="modal-actions">
        <button className="button ghost" type="button" onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          type="button"
          disabled={deltaCents === 0 || !note.trim() || member.balanceCents + deltaCents < 0}
          onClick={() => {
            onConfirm(member.id, deltaCents, note.trim());
            onClose();
          }}
        >
          确认调整
        </button>
      </div>
    </Modal>
  );
}
