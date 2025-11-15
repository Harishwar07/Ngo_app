import React, { useState, useMemo, useEffect } from 'react';
import type { FrfEntity, AnyRecord, FilterDefinition } from '../types';
import { fetch_frf_list } from '../services/mockApi';

interface ListViewProps {
  entity: FrfEntity;
  on_select_record: (id: string) => void;
}

type SortConfig = {
  key: string;
  direction: 'ascending' | 'descending';
} | null;

const format_value = (value: any): string => {
  if (typeof value === 'number' && !isNaN(value)) {
    // A simple check to avoid formatting years or IDs as currency
    if (value > 10000 || (String(value).includes('.') && String(value).split('.')[1].length === 2)) {
       return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }
  }
  // Check for ISO date string format (YYYY-MM-DDTHH:mm:ss.sssZ)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
    return new Date(value).toLocaleDateString();
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  return String(value ?? '');
}

const FilterControl: React.FC<{ filter_def: FilterDefinition, value: any, on_change: (key: string, value: any) => void}> = ({ filter_def, value, on_change }) => {
    const common_classes = "w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-sm";
    
    switch (filter_def.type) {
        case 'text':
            return <input type="text" placeholder={filter_def.label} value={value || ''} onChange={(e) => on_change(filter_def.key, e.target.value)} className={common_classes} />;
        case 'dropdown':
            return (
                <select value={value || ''} onChange={(e) => on_change(filter_def.key, e.target.value)} className={common_classes}>
                    <option value="">All {filter_def.label}s</option>
                    {filter_def.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            );
        case 'range':
            return (
                <div className="flex items-center gap-2">
                    <input type="number" placeholder="Min" value={value?.min || ''} onChange={(e) => on_change(filter_def.key, { ...value, min: e.target.value })} className={`${common_classes} text-center`} />
                    <span className="text-gray-500">-</span>
                    <input type="number" placeholder="Max" value={value?.max || ''} onChange={(e) => on_change(filter_def.key, { ...value, max: e.target.value })} className={`${common_classes} text-center`} />
                </div>
            );
        case 'daterange':
             return (
                <div className="flex items-center gap-2">
                    <input type="date" value={value?.start || ''} onChange={(e) => on_change(filter_def.key, { ...value, start: e.target.value })} className={`${common_classes} text-center`} />
                    <span className="text-gray-500">-</span>
                    <input type="date" value={value?.end || ''} onChange={(e) => on_change(filter_def.key, { ...value, end: e.target.value })} className={`${common_classes} text-center`} />
                </div>
            );
        case 'az': // A-Z is handled by sorting, no input needed.
        default:
            return null;
    }
};

export const ListView: React.FC<ListViewProps> = ({ entity, on_select_record }) => {
  const [records, set_records] = useState<AnyRecord[]>([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);
  const [search_term, set_search_term] = useState('');
  const [sort_config, set_sort_config] = useState<SortConfig>(null);
  const [filters, set_filters] = useState<Record<string, any>>({});
  const [show_filters, set_show_filters] = useState(false);

  useEffect(() => {
    set_loading(true);
    set_error(null);
    // Reset state when entity changes
    set_search_term('');
    set_sort_config(null);
    set_filters({});
    set_show_filters(false);
    
    fetch_frf_list(entity.id)
      .then(data => {
        set_records(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        console.error(err);
        set_error(`Failed to load ${entity.name} data. Please check the connection and try again.`);
      })
      .finally(() => {
        set_loading(false);
      });
  }, [entity.id]);

  const handle_filter_change = (key: string, value: any) => {
    set_filters(prev => ({...prev, [key]: value}));
  }

  const reset_filters = () => {
    set_filters({});
  }

  const filtered_and_sorted_records = useMemo(() => {
    let filtered_items = [...records];

    // 1. Advanced Filters
    const active_filter_keys = Object.keys(filters).filter(key => {
        const val = filters[key];
        if (typeof val === 'object' && val !== null) { // For range and daterange
            return val.min || val.max || val.start || val.end;
        }
        return val; // For text and dropdown
    });

    if (active_filter_keys.length > 0) {
        filtered_items = filtered_items.filter(record => {
            return active_filter_keys.every(key => {
                const filter_value = filters[key];
                const record_value = (record as any)[key];
                const filter_def = entity.filters?.find(f => f.key === key);
                if (!filter_def || !record_value) return true;

                switch (filter_def.type) {
                    case 'text':
                    case 'dropdown':
                        return String(record_value).toLowerCase().includes(String(filter_value).toLowerCase());
                    case 'range':
                        const min = parseFloat(filter_value.min);
                        const max = parseFloat(filter_value.max);
                        const value = parseFloat(record_value);
                        if (!isNaN(min) && value < min) return false;
                        if (!isNaN(max) && value > max) return false;
                        return true;
                    case 'daterange':
                        const record_date = new Date(record_value);
                        const start = filter_value.start ? new Date(filter_value.start) : null;
                        const end = filter_value.end ? new Date(filter_value.end) : null;
                        if(start) start.setHours(0,0,0,0);
                        if(end) end.setHours(23,59,59,999);
                        if (start && record_date < start) return false;
                        if (end && record_date > end) return false;
                        return true;
                    default:
                        return true;
                }
            });
        });
    }

    // 2. Global Search
    if (search_term) {
        filtered_items = filtered_items.filter(record =>
            entity.summary_fields.some(field =>
                String((record as any)[field] ?? '').toLowerCase().includes(search_term.toLowerCase())
            )
        );
    }
    
    // 3. Sorting
    if (sort_config !== null) {
      filtered_items.sort((a, b) => {
        const a_value = (a as any)[sort_config.key];
        const b_value = (b as any)[sort_config.key];
        if (a_value < b_value) {
          return sort_config.direction === 'ascending' ? -1 : 1;
        }
        if (a_value > b_value) {
          return sort_config.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered_items;
  }, [records, search_term, sort_config, entity.id, filters]);

  const request_sort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sort_config && sort_config.key === key && sort_config.direction === 'ascending') {
      direction = 'descending';
    }
    set_sort_config({ key, direction });
  };

  const get_sort_indicator = (key: string) => {
    if (!sort_config || sort_config.key !== key) return ' ↕';
    return sort_config.direction === 'ascending' ? ' ▲' : ' ▼';
  };
  
  const display_filters = entity.filters?.filter(f => f.type !== 'az') || [];

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <div className="relative w-full sm:w-2/5">
           <input
            type="text"
            placeholder={`Search ${entity.name}...`}
            className="w-full p-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 placeholder-gray-600"
            value={search_term}
            onChange={(e) => set_search_term(e.target.value)}
          />
           <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        {display_filters.length > 0 && (
             <button onClick={() => set_show_filters(!show_filters)} className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 p-2 rounded-lg hover:bg-indigo-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" /></svg>
                Advanced Filters
                <span className={`transform transition-transform ${show_filters ? 'rotate-180' : ''}`}>▼</span>
            </button>
        )}
      </div>

      {show_filters && display_filters.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg mb-4 border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {display_filters.map(filter_def => (
                    <div key={filter_def.key}>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{filter_def.label}</label>
                        <FilterControl filter_def={filter_def} value={filters[filter_def.key]} on_change={handle_filter_change} />
                    </div>
                ))}
            </div>
            <div className="text-right mt-4">
                <button onClick={reset_filters} className="text-sm font-medium text-gray-600 hover:text-indigo-600 px-4 py-1 rounded-lg hover:bg-gray-200">Clear Filters</button>
            </div>
        </div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
            <div className="text-center py-10">Loading...</div>
        ) : error ? (
            <div className="text-center py-10 text-red-600">
                <h3 className="text-lg font-semibold">An Error Occurred</h3>
                <p>{error}</p>
            </div>
        ) : (
        <table className="w-full text-left table-auto">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {entity.summary_fields.map(field => (
                <th key={field} className="p-2 text-xs md:p-4 md:text-sm font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => request_sort(field)}>
                  <div className="flex items-center">
                    {field.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase())}
                    <span className="ml-2 text-gray-400">{get_sort_indicator(field)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered_and_sorted_records.map(record => (
              <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                {entity.summary_fields.map((field, index) => (
                  <td key={field} className={`p-2 text-sm md:p-4 ${index === 0 ? 'font-medium text-indigo-600' : 'text-gray-700'}`}>
                    {index === 0 ? (
                      <a onClick={() => on_select_record(record.id)} className="cursor-pointer hover:underline">
                        {(record as any)[field]}
                      </a>
                    ) : (
                      field === 'avg_overall_score' && typeof (record as any)[field] === 'number'
                        ? ((record as any)[field] as number).toFixed(2)
                        : format_value((record as any)[field])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
       {filtered_and_sorted_records.length === 0 && !loading && !error && (
          <div className="text-center py-10 text-gray-500">
            <h3 className="text-lg font-semibold">No Records Found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        )}
    </div>
  );
};