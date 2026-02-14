import React from 'react';
import { Card, CardContent } from './ui/card';
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';

const stats = [
  {
    icon: DollarSign,
    value: '$25B',
    label: 'Market Size by 2030',
    description: 'Global digital notarization market',
  },
  {
    icon: TrendingUp,
    value: '35%',
    label: 'Annual Growth Rate',
    description: 'RON adoption CAGR',
  },
  {
    icon: Users,
    value: '50 States',
    label: 'Nationwide Coverage',
    description: 'RON now recognized everywhere',
  },
  {
    icon: Target,
    value: '70%',
    label: 'Faster Processing',
    description: 'vs traditional methods',
  },
];

const StatsSection = () => {
  return (
    <section className="py-16 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card
                key={index}
                className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800 hover:border-blue-500/50 transition-all duration-300 group"
              >
                <CardContent className="p-6 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <Icon className="w-7 h-7 text-blue-500" />
                    </div>
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                  <div className="text-sm font-semibold text-blue-400 mb-1">{stat.label}</div>
                  <div className="text-xs text-gray-500">{stat.description}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;