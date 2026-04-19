'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles, X } from 'lucide-react';
import { leadsService, Lead } from '@/services/leads';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { leadStatusLabels } from '@/utils/leadStatus';

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  phone: z.string().min(1, 'الهاتف مطلوب'),
  service: z.string().optional(),
  source: z.string().optional(),
  budget: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  lostReason: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type CreateMode = 'manual' | 'text';

interface Props {
  lead: Lead | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function LeadFormModal({ lead, onClose, onSaved }: Props) {
  const { isAdmin } = useAuth();
  const [createMode, setCreateMode] = useState<CreateMode>('manual');
  const [rawLeadText, setRawLeadText] = useState('');
  const [isCreatingFromText, setIsCreatingFromText] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: lead
      ? {
          name: lead.name,
          phone: lead.phone,
          service: lead.service,
          source: lead.source,
          budget: lead.budget,
          notes: lead.notes,
          status: lead.status,
          lostReason: lead.lostReason,
        }
      : {},
  });

  const status = watch('status');
  const editableStatuses = useMemo(
    () => Object.entries(leadStatusLabels).filter(([value]) => isAdmin || value !== 'AVAILABLE'),
    [isAdmin]
  );

  const handleManualSubmit = async (data: FormData) => {
    try {
      if (lead) {
        await leadsService.update(lead.id, data as Partial<Lead>);
        toast.success('تم تحديث العميل');
      } else {
        await leadsService.create(data as Partial<Lead>);
        toast.success('تم إنشاء العميل');
      }
      onSaved();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCreateFromText = async () => {
    if (!rawLeadText.trim()) {
      toast.error('أدخل نص العميل أولًا');
      return;
    }

    setIsCreatingFromText(true);
    try {
      await leadsService.createFromText(rawLeadText);
      toast.success('تم تحليل النص وإنشاء العميل');
      onSaved();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreatingFromText(false);
    }
  };

  const showSmartIntake = !lead && isAdmin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-modal">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-bold text-gray-900">{lead ? 'تعديل العميل' : 'عميل جديد'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {showSmartIntake ? (
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setCreateMode('manual')}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  createMode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                إدخال يدوي
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('text')}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  createMode === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                نص حر بالذكاء الاصطناعي
              </button>
            </div>
          </div>
        ) : null}

        {showSmartIntake && createMode === 'text' ? (
          <div className="space-y-4 p-6">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">ألصق أي رسالة غير مرتبة وسيتم إنشاء العميل منها</p>
                  <p className="mt-1 text-xs leading-6 text-slate-600">
                    سيتم استخراج الاسم والهاتف والخدمة والمصدر والميزانية إن وجدت، ثم إنشاء العميل مباشرة وحفظ النص الخام
                    داخل الملاحظات.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="label">نص العميل</label>
              <textarea
                value={rawLeadText}
                onChange={(event) => setRawLeadText(event.target.value)}
                className="input-field h-48 resize-none"
                placeholder="مثال: عميلة اسمها سارة من غزة، رقمها 0599xxxxxx، مهتمة بإدارة السوشيال ميديا لمطعمها، جاءت من واتساب، وميزانيتها بين 300 و500 دولار..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateFromText}
                disabled={isCreatingFromText}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isCreatingFromText ? 'جارٍ التحليل والإنشاء...' : 'تحليل النص وإنشاء العميل'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleManualSubmit)} className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">الاسم *</label>
                <input {...register('name')} className="input-field" placeholder="اسم العميل" />
                {errors.name ? <p className="mt-1 text-xs text-error">{errors.name.message}</p> : null}
              </div>
              <div>
                <label className="label">الهاتف *</label>
                <input {...register('phone')} className="input-field" placeholder="05XXXXXXXX" dir="ltr" />
                {errors.phone ? <p className="mt-1 text-xs text-error">{errors.phone.message}</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">الخدمة</label>
                <input {...register('service')} className="input-field" placeholder="نوع الخدمة" />
              </div>
              <div>
                <label className="label">المصدر</label>
                <input {...register('source')} className="input-field" placeholder="مصدر العميل" />
              </div>
            </div>

            <div>
              <label className="label">الميزانية</label>
              <input {...register('budget')} className="input-field" placeholder="نطاق الميزانية" />
            </div>

            {lead ? (
              <div>
                <label className="label">الحالة</label>
                <select {...register('status')} className="input-field">
                  {editableStatuses.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {status === 'CLOSED_LOST' ? (
              <div>
                <label className="label">سبب الخسارة</label>
                <input {...register('lostReason')} className="input-field" placeholder="سبب إغلاق العميل خسارة" />
              </div>
            ) : null}

            <div>
              <label className="label">ملاحظات</label>
              <textarea
                {...register('notes')}
                className="input-field h-24 resize-none"
                placeholder="أي ملاحظات إضافية..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                إلغاء
              </button>
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? 'جارٍ الحفظ...' : lead ? 'حفظ التعديلات' : 'إنشاء العميل'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
