'use client';

/**
 * app/(admin)/coverage/_components/CoveragePageClient.tsx — Client shell per la pagina copertura.
 *
 * Gestisce:
 *   - Stato tab attivo (Setup fabbisogni | Monitor copertura)
 *   - Apertura modal crea nuovo fabbisogno
 *   - Aggiornamento live: chiama useNotifications() per invalidare
 *     la query 'coverage-monitor' su eventi SSE shift.assigned / shift.modified
 *
 * TSK-018, RF-H CA2.
 */

import { useState } from 'react';
import { Plus, Settings, BarChart2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CoverageRuleTable } from '@/components/coverage/CoverageRuleTable';
import { CoverageRuleModal } from '@/components/coverage/CoverageRuleModal';
import { CoverageMonitorGrid } from '@/components/coverage/CoverageMonitorGrid';
import { useNotifications } from '@/hooks/useNotifications';

type TabId = 'setup' | 'monitor';

interface CoveragePageClientProps {
  qualifications: { id: string; name: string }[];
  shiftTypes: { id: string; name: string; code: string }[];
}

export function CoveragePageClient({ qualifications, shiftTypes }: CoveragePageClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('setup');
  const [createOpen, setCreateOpen] = useState(false);

  // Invalida query SSE: shift.assigned/modified → re-fetch coverage-monitor (RF-H CA2)
  useNotifications();

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'setup',
      label: 'Setup fabbisogni',
      icon: <Settings className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'monitor',
      label: 'Monitor copertura',
      icon: <BarChart2 className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="border-border border-b" role="tablist" aria-label="Sezioni copertura">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                '-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
              ].join(' ')}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panel: Setup fabbisogni */}
      <div
        role="tabpanel"
        id="panel-setup"
        aria-labelledby="tab-setup"
        hidden={activeTab !== 'setup'}
      >
        {activeTab === 'setup' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-end">
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Nuovo fabbisogno
              </Button>
            </div>

            {/* Tabella regole */}
            <CoverageRuleTable
              qualifications={qualifications}
              shiftTypes={shiftTypes}
              onAddNew={() => setCreateOpen(true)}
            />

            {/* Modal creazione */}
            <CoverageRuleModal
              mode="create"
              open={createOpen}
              onOpenChange={setCreateOpen}
              qualifications={qualifications}
              shiftTypes={shiftTypes}
            />
          </div>
        )}
      </div>

      {/* Tab panel: Monitor copertura */}
      <div
        role="tabpanel"
        id="panel-monitor"
        aria-labelledby="tab-monitor"
        hidden={activeTab !== 'monitor'}
      >
        {activeTab === 'monitor' && <CoverageMonitorGrid />}
      </div>
    </div>
  );
}
