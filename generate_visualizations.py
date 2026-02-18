'''
import matplotlib.pyplot as plt
import numpy as np

# Data from cost analysis
scenarios = {
    "Micro": {"atomspaces": 3, "cost": 8.21},
    "Small": {"atomspaces": 10, "cost": 34.64},
    "Medium": {"atomspaces": 50, "cost": 212.72},
    "Large": {"atomspaces": 100, "cost": 495.75},
    "Very Large": {"atomspaces": 500, "cost": 2829.15},
    "Extreme": {"atomspaces": 1000, "cost": 5659.50},
}

atomspaces = [s["atomspaces"] for s in scenarios.values()]
costs = [s["cost"] for s in scenarios.values()]

# --- 1. Cost Scaling Chart ---
plt.figure(figsize=(10, 6))
plt.plot(atomspaces, costs, marker='o', linestyle='-', color='#1f77b4')
plt.xscale('log')
plt.yscale('log')
plt.title('FlareCog Cost Scaling vs. Number of AtomSpaces', fontsize=16)
plt.xlabel('Number of AtomSpaces (log scale)', fontsize=12)
plt.ylabel('Estimated Monthly Cost (USD, log scale)', fontsize=12)
plt.grid(True, which="both", ls="--", c='0.7')
plt.xticks(atomspaces, labels=[str(a) for a in atomspaces])
plt.yticks([10, 100, 1000, 10000], labels=['$10', '$100', '$1,000', '$10,000'])
plt.savefig('/home/ubuntu/cogflare-temp/cost_scaling.png', dpi=300)
plt.close()

# --- 2. Cost Breakdown Chart ---
cost_breakdown = {
    'Small (10)': {'Duration': 15.74, 'Storage': 13.00, 'Requests': 0.35, 'Writes': 0.55},
    'Large (100)': {'Duration': 340.60, 'Storage': 139.40, 'Requests': 4.80, 'Writes': 5.95},
    'Extreme (1000)': {'Duration': 4142.20, 'Storage': 1403.00, 'Requests': 49.35, 'Writes': 59.95},
}

labels = list(cost_breakdown.keys())
data = np.array([list(v.values()) for v in cost_breakdown.values()])
data_cum = data.cumsum(axis=1)
category_colors = plt.get_cmap('RdYlGn_r')(np.linspace(0.15, 0.85, data.shape[1]))

fig, ax = plt.subplots(figsize=(10, 6))
ax.invert_yaxis()
ax.xaxis.set_visible(False)
ax.set_xlim(0, np.sum(data, axis=1).max())

for i, (colname, color) in enumerate(zip(cost_breakdown['Small (10)'].keys(), category_colors)):
    widths = data[:, i]
    starts = data_cum[:, i] - widths
    ax.barh(labels, widths, left=starts, height=0.5, label=colname, color=color)

ax.legend(ncol=len(cost_breakdown['Small (10)'].keys()), bbox_to_anchor=(0, 1), loc='lower left', fontsize='small')
plt.title('Cost Component Breakdown by Deployment Scale', fontsize=16)
plt.savefig('/home/ubuntu/cogflare-temp/cost_breakdown.png', dpi=300, bbox_inches='tight')
plt.close()

# --- 3. Feasibility Zones Chart ---
feasibility_zones = {
    "Highly Feasible": (1, 20, "#2ca02c"),
    "Feasible": (20, 100, "#98df8a"),
    "Marginally Feasible": (100, 500, "#ff7f0e"),
    "Questionable": (500, 2000, "#d62728"),
    "Infeasible": (2000, 10000, "#8c564b"),
}

fig, ax = plt.subplots(figsize=(10, 4))

for i, (zone, (start, end, color)) in enumerate(feasibility_zones.items()):
    ax.barh(i, end - start, left=start, color=color, edgecolor='white')
    ax.text(start + (end - start) / 2, i, f'{zone}\n({start}-{end} AtomSpaces)', ha='center', va='center', color='white', fontsize=10, weight='bold')

ax.set_xscale('log')
ax.set_yticks([])
ax.set_xlabel('Number of AtomSpaces (log scale)')
plt.title('Practical Feasibility Zones for FlareCog Deployment', fontsize=16)
plt.savefig('/home/ubuntu/cogflare-temp/feasibility_zones.png', dpi=300, bbox_inches='tight')
plt.close()
'''
