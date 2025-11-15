import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ListView } from './components/ListView';
import { DetailView } from './components/DetailView';
import type { FrfEntity } from './types';
import { FRF_ENTITIES, NGO_ICON } from './constants';
import { Header } from './components/Header';

type ViewState = 
  | { mode: 'welcome' }
  | { mode: 'list'; entity: FrfEntity }
  | { mode: 'detail'; entity: FrfEntity; id: string };

const App: React.FC = () => {
  const [view_state, set_view_state] = useState<ViewState>({ mode: 'welcome' });
  const [selected_entity_id, set_selected_entity_id] = useState<FrfEntity['id'] | null>(null);
  const [is_sidebar_open, set_sidebar_open] = useState(false);

  const handle_select_entity = (entity: FrfEntity) => {
    set_selected_entity_id(entity.id);
    set_view_state({ mode: 'list', entity });
    set_sidebar_open(false); // Close sidebar on selection for better mobile UX
  };

  const handle_select_record = (id: string) => {
    if (view_state.mode === 'list') {
      set_view_state({ mode: 'detail', entity: view_state.entity, id });
    }
  };

  const handle_back_to_list = () => {
    if ('entity' in view_state) {
        set_view_state({ mode: 'list', entity: view_state.entity });
    }
  };

  const get_selected_entity = () => {
    return FRF_ENTITIES.find(e => e.id === selected_entity_id) || null;
  }

  const get_title = () => {
      switch(view_state.mode) {
          case 'welcome': return 'Welcome';
          case 'list': return `${view_state.entity.name} List`;
          case 'detail': return `Details`;
          default: return 'NGO Data Hub';
      }
  }

  const render_content = () => {
    switch (view_state.mode) {
      case 'welcome':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 mb-4 text-indigo-500">{NGO_ICON}</div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-700">Welcome to the NGO Data Hub</h1>
            <p className="mt-2 text-md md:text-lg text-gray-500">Select a category from the sidebar to view records.</p>
          </div>
        );
      case 'list':
        return <ListView entity={view_state.entity} on_select_record={handle_select_record} />;
      case 'detail':
        return <DetailView entity={view_state.entity} id={view_state.id} on_back={handle_back_to_list} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800">
      {/* Backdrop for mobile sidebar */}
      {is_sidebar_open && (
        <div
          onClick={() => set_sidebar_open(false)}
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          aria-hidden="true"
        />
      )}
      <Sidebar
        entities={FRF_ENTITIES}
        selected_entity={get_selected_entity()}
        on_select_entity={handle_select_entity}
        is_open={is_sidebar_open}
        set_is_open={set_sidebar_open}
      />
      <div className={`flex-1 flex flex-col transition-all duration-300 md:ml-64`}>
        <Header 
          on_toggle_sidebar={() => set_sidebar_open(!is_sidebar_open)} 
          is_sidebar_open={is_sidebar_open}
          title={get_title()}
          entity_name={'entity' in view_state ? view_state.entity.name : undefined}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {render_content()}
        </main>
      </div>
    </div>
  );
};

export default App;