$pages = @(
    'Dashboard.tsx', 'Products.tsx', 'Categories.tsx', 'Customers.tsx', 
    'Suppliers.tsx', 'Purchases.tsx', 'Sales.tsx', 'POS.tsx', 
    'Expenses.tsx', 'Inventory.tsx', 'Reports.tsx', 'Settings.tsx'
)
New-Item -ItemType Directory -Force -Path "src\pages\stationery"
foreach ($p in $pages) {
    $name = $p.Replace('.tsx', '')
    $content = "export default function $name() { return <div>$name</div>; }"
    Set-Content -Path "src\pages\stationery\$p" -Value $content
}
