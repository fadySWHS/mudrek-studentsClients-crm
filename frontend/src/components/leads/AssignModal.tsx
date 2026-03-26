'use client';
import { useState } from 'react';
import { Lead } from '@/services/leads';
import { Student } from '@/services/students';
import { leadsService } from '@/services/leads';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface Props {
  lead: Lead;
  students: Student[];
  onClose: () => void;
  onSaved: () => void;
}

export default function AssignModal({ lead, students, onClose, onSaved }: Props) {
  const [selectedId, setSelectedId] = useState(lead.assignedToId || '');
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    setLoading(true);
    try {
      await leadsService.update(lead.id, { assignedToId: selectedId || undefined } as any);
      toast.success('تم تعيين العميل');
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">تعيين عميل</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            تعيين <span className="font-semibold text-gray-900">{lead.name}</span> إلى:
          </p>
          <select
            className="input-field mb-4"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">بدون تعيين (متاح)</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">إلغاء</button>
            <button onClick={handleAssign} disabled={loading} className="btn-primary">
              {loading ? 'جارٍ التعيين...' : 'تعيين'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
