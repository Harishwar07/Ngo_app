import React, { useState } from 'react';
import type { FrfEntity, AnyRecord, FormField } from '../types';
import { create_frf_record } from '../services/mockApi';

interface CreateViewProps {
  entity: FrfEntity;
  on_cancel: () => void;
  on_save_success: () => void;
}

export const CreateView: React.FC<CreateViewProps> = ({ entity, on_cancel, on_save_success }) => {
  const [form_data, set_form_data] = useState<Partial<AnyRecord>>(() => {
    const initial_state: Partial<AnyRecord> = {};
    entity.create_fields?.forEach(field => {
        (initial_state as any)[field.key] = field.default_value ?? '';
    });
    return initial_state;
  });
  const [is_saving, set_is_saving] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const handle_change = (key: string, value: string | number) => {
    set_form_data(prev => ({ ...prev, [key]: value }));
  };

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    set_error(null);

    // Basic Validation
    for (const field of entity.create_fields || []) {
        if (field.required && !(form_data as any)[field.key]) {
            set_error(`Field "${field.label}" is required.`);
            return;
        }
    }

    set_is_saving(true);
    try {
        await create_frf_record(entity.id, form_data);
        on_save_success();
    } catch (err) {
        console.error(err);
        set_error(`Failed to create ${entity.name}. Please try again.`);
    } finally {
        set_is_saving(false);
    }
  };
  
  const render_field = (field: FormField) => {
    const common_classes = "w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500";
    const value = (form_data as any)[field.key] as string || '';

    switch (field.type) {
        case 'textarea':
            return <textarea id={field.key} value={value} onChange={e => handle_change(field.key, e.target.value)} required={field.required} className={common_classes} rows={4} />;
        case 'select':
            return (
                <select id={field.key} value={value} onChange={e => handle_change(field.key, e.target.value)} required={field.required} className={common_classes}>
                    <option value="">Select {field.label}</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            );
        default:
            return <input type={field.type} id={field.key} value={value} onChange={e => handle_change(field.key, e.target.value)} required={field.required} className={common_classes} />;
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
        <button onClick={on_cancel} className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {entity.name} List
        </button>
      
        <form onSubmit={handle_submit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {entity.create_fields?.map(field => (
                    <div key={field.key}>
                        <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {render_field(field)}
                    </div>
                ))}
            </div>
            
            {error && <div className="mt-4 text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 mt-8 pt-6 border-t">
                <button type="button" onClick={on_cancel} className="w-full sm:w-auto bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors">
                    Cancel
                </button>
                <button type="submit" disabled={is_saving} className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-300">
                    {is_saving ? 'Saving...' : 'Save Record'}
                </button>
            </div>
        </form>
    </div>
  );
};
