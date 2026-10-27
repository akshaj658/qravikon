import { useState, useCallback, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle } from 'lucide-react';
import type { MarketSizingEdits } from '../lib/api';
import { formatCurrency } from '../lib/utils';

export interface MarketData {
  currency: string;
  assumptions: {
    totalPotentialCustomers: number;
    segmentPercentage: number;
    geographyNote: string;
    annualRevenuePerCustomer: number;
    reachableShare: number;
    timeHorizonYears: number;
  };
  calculations: {
    tam: number;
    sam: number;
    som: number;
    tamFormula: string;
    samFormula: string;
    somFormula: string;
  };
  scenarios: {
    low: { tam: number; sam: number; som: number };
    base: { tam: number; sam: number; som: number };
    high: { tam: number; sam: number; som: number };
  };
  disclaimer: string;
}

interface Props {
  initialData?: MarketData;
  onChange?: (edits: MarketSizingEdits) => void;
  onValidityChange?: (isValid: boolean) => void;
}

function calculateMarket(assumptions: {
  totalPotentialCustomers: number;
  segmentPercentage: number;
  annualRevenuePerCustomer: number;
  reachableShare: number;
}) {
  const { totalPotentialCustomers, segmentPercentage, annualRevenuePerCustomer, reachableShare } = assumptions;
  const tam = totalPotentialCustomers * annualRevenuePerCustomer;
  const sam = tam * (segmentPercentage / 100);
  const som = sam * (reachableShare / 100);
  return { tam, sam, som };
}

export default function MarketCalculator({ initialData, onChange, onValidityChange }: Props) {
  const defaultAssumptions = {
    totalPotentialCustomers: initialData?.assumptions?.totalPotentialCustomers ?? 1_000_000,
    segmentPercentage: initialData?.assumptions?.segmentPercentage ?? 10,
    annualRevenuePerCustomer: initialData?.assumptions?.annualRevenuePerCustomer ?? 100,
    reachableShare: initialData?.assumptions?.reachableShare ?? 5,
    geographyNote: initialData?.assumptions?.geographyNote ?? 'United States',
    timeHorizonYears: initialData?.assumptions?.timeHorizonYears ?? 3,
  };

  const [assumptions, setAssumptions] = useState(defaultAssumptions);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeScenario, setActiveScenario] = useState<'low' | 'base' | 'high'>('base');
  const [hasEditedAssumptions, setHasEditedAssumptions] = useState(false);

  const validate = useCallback((field: string, value: number): string | null => {
    if (!Number.isFinite(value) || value < 0) return 'Must be a finite positive number';
    if ((field === 'segmentPercentage' || field === 'reachableShare') && value > 100) return 'Must be ≤ 100%';
    if (field === 'totalPotentialCustomers' && value === 0) return 'Cannot be zero';
    if (field === 'annualRevenuePerCustomer' && value === 0) return 'Cannot be zero';
    return null;
  }, []);

  function update(field: keyof typeof assumptions, value: number | string) {
    setHasEditedAssumptions(true);
    if (field === 'geographyNote') {
      setAssumptions(prev => ({ ...prev, geographyNote: value as string }));
      return;
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const err = validate(field, num);
    setErrors(prev => ({ ...prev, [field]: err ?? '' }));
    if (!err) {
      setAssumptions(prev => ({ ...prev, [field]: num }));
    }
  }

  const { tam, sam, som } = calculateMarket(assumptions);

  const calculatedScenarios = useMemo(() => ({
    low: calculateMarket({
      ...assumptions,
      totalPotentialCustomers: assumptions.totalPotentialCustomers * 0.6,
      segmentPercentage: assumptions.segmentPercentage * 0.7,
      reachableShare: assumptions.reachableShare * 0.5,
    }),
    base: { tam, sam, som },
    high: calculateMarket({
      ...assumptions,
      totalPotentialCustomers: assumptions.totalPotentialCustomers * 1.5,
      segmentPercentage: assumptions.segmentPercentage * 1.3,
      reachableShare: assumptions.reachableShare * 1.5,
    }),
  }), [assumptions, sam, som, tam]);
  const scenarios = useMemo(
    () => hasEditedAssumptions ? calculatedScenarios : initialData?.scenarios ?? calculatedScenarios,
    [calculatedScenarios, hasEditedAssumptions, initialData?.scenarios]
  );
  const formulas = hasEditedAssumptions
    ? {
        tam: `${assumptions.totalPotentialCustomers.toLocaleString()} customers × $${assumptions.annualRevenuePerCustomer.toLocaleString()}/yr`,
        sam: `TAM × ${assumptions.segmentPercentage}% segment`,
        som: `SAM × ${assumptions.reachableShare}% reachable`,
      }
    : {
        tam: initialData?.calculations?.tamFormula ?? `${assumptions.totalPotentialCustomers.toLocaleString()} customers × $${assumptions.annualRevenuePerCustomer.toLocaleString()}/yr`,
        sam: initialData?.calculations?.samFormula ?? `TAM × ${assumptions.segmentPercentage}% segment`,
        som: initialData?.calculations?.somFormula ?? `SAM × ${assumptions.reachableShare}% reachable`,
      };

  const hasErrors = Object.values(errors).some(Boolean);

  useEffect(() => {
    onValidityChange?.(!hasErrors);
    if (hasErrors) return;
    onChange?.({
      assumptions,
      calculations: {
        tam,
        sam,
        som,
        tamFormula: `${assumptions.totalPotentialCustomers.toLocaleString()} customers × $${assumptions.annualRevenuePerCustomer.toLocaleString()}/yr`,
        samFormula: `TAM × ${assumptions.segmentPercentage}% segment`,
        somFormula: `SAM × ${assumptions.reachableShare}% reachable`,
      },
      scenarios,
    });
  }, [assumptions, errors, hasErrors, onChange, onValidityChange, sam, scenarios, som, tam]);

  const currentScenario = scenarios[activeScenario];

  const chartData = [
    { name: 'TAM', value: currentScenario.tam, color: '#3b82f6' },
    { name: 'SAM', value: currentScenario.sam, color: '#60a5fa' },
    { name: 'SOM', value: currentScenario.som, color: '#93c5fd' },
  ];

  return (
    <div className="space-y-6">
      {/* Scenario selector */}
      <div className="flex items-center gap-1 p-1 bg-bg-elevated rounded border border-border-default w-fit">
        {(['low', 'base', 'high'] as const).map((s) => (
          <button
            key={s}
            className={`px-3 py-1 rounded text-xs font-medium transition-all duration-100 ${
              activeScenario === s
                ? 'bg-bg-base text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            onClick={() => setActiveScenario(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'TAM', value: currentScenario.tam, desc: 'Total addressable market' },
          { label: 'SAM', value: currentScenario.sam, desc: 'Serviceable addressable market' },
          { label: 'SOM', value: currentScenario.som, desc: 'Serviceable obtainable market' },
        ].map(({ label, value, desc }) => (
          <div key={label} className="bg-bg-elevated rounded border border-border-default p-4">
            <div className="text-2xs text-text-muted mb-1">{label}</div>
            <div className="text-2xl font-semibold text-text-primary">{formatCurrency(value)}</div>
            <div className="text-2xs text-text-disabled mt-0.5">{desc}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={40}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#71717a' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(v)}
              tick={{ fontSize: 10, fill: '#71717a' }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              formatter={(v: number) => [formatCurrency(v, 'USD', false), '']}
              contentStyle={{
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#fafafa',
              }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Editable assumptions */}
      <div>
        <div className="section-label mb-3">Edit assumptions</div>
        {hasErrors && (
          <div className="mb-3 p-2.5 rounded border border-danger/30 bg-danger-subtle flex gap-2 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0 mt-0.5" />
            <span className="text-danger">Fix validation errors to recalculate.</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'totalPotentialCustomers', label: 'Total potential customers', type: 'number', min: 1 },
            { key: 'annualRevenuePerCustomer', label: 'Annual revenue per customer ($)', type: 'number', min: 1 },
            { key: 'segmentPercentage', label: 'Segment size (%)', type: 'number', min: 0.1, max: 100 },
            { key: 'reachableShare', label: 'Reachable share (%)', type: 'number', min: 0.1, max: 100 },
          ].map(({ key, label, min, max }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type="number"
                className={`input text-sm ${errors[key] ? 'border-danger' : ''}`}
                defaultValue={assumptions[key as keyof typeof assumptions] as number}
                min={min}
                max={max}
                step={key.includes('Percentage') || key.includes('Share') ? 0.5 : 1}
                onChange={e => update(key as keyof typeof assumptions, e.target.value)}
              />
              {errors[key] && <p className="text-2xs text-danger mt-1">{errors[key]}</p>}
            </div>
          ))}
        </div>

        <div className="mt-3">
          <label className="label">Geography</label>
          <input
            className="input text-sm"
            defaultValue={assumptions.geographyNote}
            onChange={e => update('geographyNote', e.target.value)}
            placeholder="e.g. United States, SMB retailers"
          />
        </div>
      </div>

      {/* Formulas */}
      <div className="space-y-2">
        <div className="section-label">Formulas</div>
        {[
          { label: 'TAM', formula: formulas.tam },
          { label: 'SAM', formula: formulas.sam },
          { label: 'SOM', formula: formulas.som },
        ].map(({ label, formula }) => (
          <div key={label} className="flex gap-2 text-xs">
            <span className="text-text-muted w-8">{label} =</span>
            <span className="text-text-secondary font-mono">{formula}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-disabled border-t border-border-subtle pt-3">
        {initialData?.disclaimer ?? 'Market sizing is based on estimates and assumptions. It does not prove customer demand.'}
      </p>
    </div>
  );
}
