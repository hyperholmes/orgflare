#!/usr/bin/env python3
"""
Visualize crisis burst scenario costs for FlareCog
"""

import matplotlib.pyplot as plt
import numpy as np

# Set style
plt.style.use('dark_background')

# Cost breakdown data
categories = ['DO Active\nTime', 'DO\nRequests', 'DO Storage\nI/O', 'Workers\nPlatform']
standard_workers = [112.61, 4.09, 26.10, 8.94]
wfp = [112.61, 4.09, 26.10, 27.18]

# Figure 1: Cost breakdown comparison
fig1, ax1 = plt.subplots(figsize=(12, 7))
x = np.arange(len(categories))
width = 0.35

bars1 = ax1.bar(x - width/2, standard_workers, width, label='Standard Workers', color='#3b82f6')
bars2 = ax1.bar(x + width/2, wfp, width, label='Workers for Platforms', color='#8b5cf6')

ax1.set_xlabel('Cost Component', fontsize=12, fontweight='bold')
ax1.set_ylabel('Cost ($)', fontsize=12, fontweight='bold')
ax1.set_title('Crisis Burst Scenario: Cost Breakdown\n1000 AtomSpaces × 45 minutes', 
              fontsize=14, fontweight='bold', pad=20)
ax1.set_xticks(x)
ax1.set_xticklabels(categories)
ax1.legend(fontsize=11)
ax1.grid(axis='y', alpha=0.3, linestyle='--')

# Add value labels on bars
for bars in [bars1, bars2]:
    for bar in bars:
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height,
                f'${height:.2f}',
                ha='center', va='bottom', fontsize=9)

# Add total cost annotations
total_sw = sum(standard_workers)
total_wfp = sum(wfp)
ax1.text(0.02, 0.98, f'Total (Standard): ${total_sw:.2f}', 
         transform=ax1.transAxes, fontsize=11, fontweight='bold',
         verticalalignment='top', bbox=dict(boxstyle='round', facecolor='#3b82f6', alpha=0.3))
ax1.text(0.02, 0.90, f'Total (WFP): ${total_wfp:.2f}', 
         transform=ax1.transAxes, fontsize=11, fontweight='bold',
         verticalalignment='top', bbox=dict(boxstyle='round', facecolor='#8b5cf6', alpha=0.3))

plt.tight_layout()
plt.savefig('/home/ubuntu/cogflare-temp/crisis_burst_breakdown.png', dpi=150, bbox_inches='tight')
plt.close()

# Figure 2: Cost composition pie charts
fig2, (ax2a, ax2b) = plt.subplots(1, 2, figsize=(14, 6))

colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6']
explode = (0.05, 0, 0, 0)

# Standard Workers pie
ax2a.pie(standard_workers, labels=categories, autopct='%1.1f%%',
         colors=colors, explode=explode, startangle=90, textprops={'fontsize': 10})
ax2a.set_title(f'Standard Workers\nTotal: ${total_sw:.2f}', 
               fontsize=13, fontweight='bold', pad=15)

# WFP pie
ax2b.pie(wfp, labels=categories, autopct='%1.1f%%',
         colors=colors, explode=explode, startangle=90, textprops={'fontsize': 10})
ax2b.set_title(f'Workers for Platforms\nTotal: ${total_wfp:.2f}', 
               fontsize=13, fontweight='bold', pad=15)

fig2.suptitle('Crisis Burst Cost Composition', fontsize=15, fontweight='bold', y=0.98)
plt.tight_layout()
plt.savefig('/home/ubuntu/cogflare-temp/crisis_burst_composition.png', dpi=150, bbox_inches='tight')
plt.close()

# Figure 3: Scaling analysis
atomspace_counts = [1, 10, 100, 500, 1000, 2000, 5000, 10000]
durations_hours = [720, 72, 7.2, 1.44, 0.75, 0.375, 0.15, 0.075]
durations_readable = ['30d', '3d', '7.2h', '1.4h', '45m', '22m', '9m', '4.5m']

# Calculate costs for each scale (Standard Workers with R2 optimization)
costs = []
for count in atomspace_counts:
    duration = 720 / count  # hours
    active_time = count * duration * 0.15
    requests = count * 27000 * 0.15 / 1_000_000
    storage_io = (count * 20 / 1000 * 0.20) + (count * 20 / 1000 * 0.005)  # R2 writes
    workers = 5 + max(0, (count * 27000 - 1_000_000) / 1_000_000 * 0.15)
    total = active_time + requests + storage_io + workers
    costs.append(total)

# Cost per equivalent compute-hour
cost_per_hour = [cost / 720 for cost in costs]

fig3, (ax3a, ax3b) = plt.subplots(1, 2, figsize=(14, 6))

# Total cost vs scale
ax3a.plot(atomspace_counts, costs, marker='o', linewidth=2, markersize=8, color='#3b82f6')
ax3a.set_xscale('log')
ax3a.set_xlabel('Number of AtomSpaces', fontsize=12, fontweight='bold')
ax3a.set_ylabel('Total Cost ($)', fontsize=12, fontweight='bold')
ax3a.set_title('Total Cost vs Scale', fontsize=13, fontweight='bold', pad=15)
ax3a.grid(True, alpha=0.3, linestyle='--')

# Annotate optimal point
optimal_idx = 4  # 1000 AtomSpaces
ax3a.annotate(f'Optimal: 1000 AS\n${costs[optimal_idx]:.2f}',
             xy=(atomspace_counts[optimal_idx], costs[optimal_idx]),
             xytext=(atomspace_counts[optimal_idx] * 0.3, costs[optimal_idx] * 1.3),
             arrowprops=dict(arrowstyle='->', color='#10b981', lw=2),
             fontsize=10, fontweight='bold', color='#10b981',
             bbox=dict(boxstyle='round', facecolor='#10b981', alpha=0.2))

# Cost efficiency (cost per compute-hour)
ax3b.plot(atomspace_counts, cost_per_hour, marker='s', linewidth=2, markersize=8, color='#10b981')
ax3b.set_xscale('log')
ax3b.set_xlabel('Number of AtomSpaces', fontsize=12, fontweight='bold')
ax3b.set_ylabel('Cost per Equivalent Compute-Hour ($)', fontsize=12, fontweight='bold')
ax3b.set_title('Cost Efficiency vs Scale', fontsize=13, fontweight='bold', pad=15)
ax3b.grid(True, alpha=0.3, linestyle='--')
ax3b.axhline(y=cost_per_hour[optimal_idx], color='#10b981', linestyle='--', alpha=0.5)
ax3b.text(atomspace_counts[0] * 1.5, cost_per_hour[optimal_idx] * 1.1, 
         f'${cost_per_hour[optimal_idx]:.2f}/hr', color='#10b981', fontweight='bold')

fig3.suptitle('Scaling Analysis: Crisis Burst Scenarios', fontsize=15, fontweight='bold', y=0.98)
plt.tight_layout()
plt.savefig('/home/ubuntu/cogflare-temp/crisis_burst_scaling.png', dpi=150, bbox_inches='tight')
plt.close()

# Figure 4: Time vs Cost tradeoff
fig4, ax4 = plt.subplots(figsize=(12, 7))

# Convert durations to minutes for better readability
durations_minutes = [h * 60 for h in durations_hours]

# Create scatter plot with size representing efficiency
sizes = [1000 / (c / 720) for c in costs]  # Larger = more efficient

scatter = ax4.scatter(durations_minutes, costs, s=sizes, c=cost_per_hour, 
                     cmap='RdYlGn_r', alpha=0.7, edgecolors='white', linewidth=2)

ax4.set_xscale('log')
ax4.set_xlabel('Time to Solution (minutes)', fontsize=12, fontweight='bold')
ax4.set_ylabel('Total Cost ($)', fontsize=12, fontweight='bold')
ax4.set_title('Crisis Burst: Time vs Cost Tradeoff\n(Bubble size = efficiency, color = cost/hour)', 
              fontsize=14, fontweight='bold', pad=20)
ax4.grid(True, alpha=0.3, linestyle='--')

# Add colorbar
cbar = plt.colorbar(scatter, ax=ax4)
cbar.set_label('Cost per Compute-Hour ($)', fontsize=11, fontweight='bold')

# Annotate key points
for i, (count, dur_min, cost) in enumerate(zip(atomspace_counts, durations_minutes, costs)):
    if count in [1, 100, 1000, 10000]:
        label = f'{count} AS\n{durations_readable[i]}'
        ax4.annotate(label, xy=(dur_min, cost), xytext=(10, 10),
                    textcoords='offset points', fontsize=9,
                    bbox=dict(boxstyle='round', facecolor='black', alpha=0.6))

# Highlight optimal region
ax4.axvspan(20, 60, alpha=0.1, color='#10b981', label='Optimal Region (20-60 min)')
ax4.legend(fontsize=10)

plt.tight_layout()
plt.savefig('/home/ubuntu/cogflare-temp/crisis_burst_tradeoff.png', dpi=150, bbox_inches='tight')
plt.close()

print("✅ All visualizations generated successfully!")
print("   - crisis_burst_breakdown.png")
print("   - crisis_burst_composition.png")
print("   - crisis_burst_scaling.png")
print("   - crisis_burst_tradeoff.png")
