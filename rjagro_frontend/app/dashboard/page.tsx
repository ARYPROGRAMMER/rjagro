'use client'
import React, { useState } from 'react';
import { fetchPurchases, handleAddPurchase } from '../api/purchases';
import { fetchItems, handleAddItem } from '../api/items';
import PurchasesTable from '../components/tables/purchases';
import { useAuth } from '../hooks/useAuth';
import ItemsTable from '../components/tables/items';
import { fetchFarmers, handleAddFarmer } from '../api/farmers';
import FarmersTable from '../components/tables/farmers';
import { fetchSuppliers, handleAddSupplier } from '../api/supplier';
import SuppliersTable from '../components/tables/suppliers';
import { fetchTraders, handleAddTrader } from '../api/traders';
import TradersTable from '../components/tables/traders';
import { fetchProductionLines, handleAddProductionLine } from '../api/production_line';
import ProductionLinesTable from '../components/tables/production_lines';
import { fetchSupervisors } from '../api/supervisors';
import { fetchBatchClosures, fetchBatches, fetchFarmerCommissionHistory, handleAddBatch, handleAddFarmerCommission, handleCloseBatch } from '../api/batches';
import BatchesTable from '../components/tables/batches';
import { fetchBatchRequirements, handleAddBatchRequirement } from '../api/batch_requirements';
import BatchRequirementsTable from '../components/tables/batch_requirements';
import { fetchBatchAllocations } from '../api/batch_allocations';
import BatchAllocationsTable from '../components/tables/batch_allocations';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchInventory, handleAddInventory, handleUpdateInventory } from '../api/inventory';
import InventoryTable from '../components/tables/inventory';
import { fetchInventoryMovements, handleAddInventoryMovement } from '../api/inventory_movement';
import InventoryMovementsTable from '../components/tables/inventory_movement';
import { BatchAllocationLinePayload, BatchClosurePayload, BatchPayload, BatchSalePayload, CreateFarmerCommission, InventoryMovementPayload, InventoryPayload, Item, LedgerAccountType, LedgerEntryPayload, MovementType, NewBatchAllocationLine, NewBatchRequirement, NewBatchSale, NewBirdCountHistory, NewFarmer, NewInventory, NewInventoryMovement, NewLedgerAccount, NewLedgerEntry, NewPurchase, NewStockReceipt, NewTrader, ProductionLinePayload, PurchasePayload, StockReceiptPayload, SupplierPayload, SupplierType } from '../types/interfaces';
import { fetchLedgerEntries, handleAddLedgerEntry } from '../api/ledger_entries';
import LedgerEntriesTable from '../components/tables/ledger_entries';
import { fetchStockReceipts, handleAddStockReceipt } from '../api/stock_receipts';
import StockReceiptsTable from '../components/tables/stock_receipts';
import { fetchBatchAllocationLines, handleAddBatchAllocationLine, handleDeleteBatchAllocationLine } from '../api/batch_allocation_lines';
import BatchAllocationLinesTable from '../components/tables/batch_allocation_line';
import { fetchLedgerAccounts, handleAddLedgerAccount } from '../api/ledger_accounts';
import LedgerAccountsTable from '../components/tables/ledger_accounts';
import { fetchBirdCountHistory, handleAddBirdCountHistory } from '../api/bird_count_history';
import BirdCountHistoryTable from '../components/tables/bird_count_history';
import BatchClosureSummaryTable from '../components/tables/batch_closure_summary';
import { fetchBatchSales, handleAddBatchSale } from '../api/batch_sales';
import BatchSalesTable from '../components/tables/batch_sales';
import { ItemCategory } from '../types/enums';
import Greeter from '../components/Greeter';


const Dashboard = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();


    const [activeTab, setActiveTab] = useState('Purchases');
    const { data: purchases = [],
        // isLoading: loadingPurchases 
    } = useQuery({
        queryKey: ['purchases'],
        queryFn: fetchPurchases,
        staleTime: 5 * 60 * 1000,
    });
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newPurchase, setNewPurchase] = useState<NewPurchase>({
        item_code: '',
        item_name: '',
        cost_per_unit: '',
        quantity: '',
        supplier: '',
        payment_method: '',
        payment_account: undefined,
        inventory_account_id: undefined,
        payment_account_id: undefined
    });

    const final: PurchasePayload = {
        item_code: newPurchase.item_code,
        cost_per_unit: Number(newPurchase.cost_per_unit),
        total_cost: Number(newPurchase.cost_per_unit) * Number(newPurchase.quantity),
        quantity: Number(newPurchase.quantity),
        purchase_date: new Date().toISOString().slice(0, 10),
        supplier: newPurchase.supplier,
        payment_account: newPurchase.payment_account ?? LedgerAccountType.Asset,
        // fix this shit
        created_by: user ? user.user_id : 9999,
        inventory_account_id: newPurchase.inventory_account_id!,  // Required field
        payment_account_id: newPurchase.payment_account_id!
    };

    // items
    const { data: items = [],
        //  isLoading: loadingItems 
    } = useQuery({
        queryKey: ['items'],
        queryFn: fetchItems,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });
    const [newItem, setNewItem] = useState<Item>({
        item_code: '',
        item_name: '',
        unit: '',
        item_category: ItemCategory.Feed
    });

    const [showAddItemForm, setShowAddItemForm] = useState(false);

    // Farmers state
    const { data: farmers = [],
        //  isLoading: loadingFarmers 
    } = useQuery({
        queryKey: ["farmers"],
        queryFn: fetchFarmers,
        staleTime: 5 * 60 * 1000,
    });
    const [newFarmer, setNewFarmer] = useState<NewFarmer>({
        name: '',
        phone_number: '',
        address: '',
        bank_account_no: '',
        bank_name: '',
        ifsc_code: '',
        area_size: 0
    });

    //Suppliers state
    const { data: suppliers = [],
        // isLoading: loadingSuppliers 
    } = useQuery({
        queryKey: ['suppliers'],
        queryFn: fetchSuppliers,
        staleTime: 5 * 60 * 1000, // cache 5 min
    });
    const [newSupplier, setNewSupplier] = useState<SupplierPayload>({
        supplier_type: SupplierType.Chick,
        name: '',
        phone_number: '',
        address: '',
        bank_account_no: '',
        bank_name: '',
        ifsc_code: ''
    });

    // Traders state
    const { data: traders = [],
        // isLoading: loadingTraders
    } = useQuery({
        queryKey: ['traders'],
        queryFn: fetchTraders,
        staleTime: 5 * 60 * 1000, // cache for 5 minutes
    });

    const [newTrader, setNewTrader] = useState<NewTrader>({
        name: '',
        phone_number: '',
        address: '',
        bank_account_no: '',
        bank_name: '',
        ifsc_code: '',
    });

    // Production Lines state
    const [newProductionLine, setNewProductionLine] = useState<ProductionLinePayload>({
        line_name: '',
        supervisor_id: 0,
    });

    const { data: productionLines = [],
        //  isLoading: loadingProductionLines 
    } = useQuery({
        queryKey: ['production_lines'],
        queryFn: fetchProductionLines,
        staleTime: 5 * 60 * 1000,
    });

    const { data: supervisors = [],
        //  isLoading: loadingSupervisors
    } = useQuery({
        queryKey: ['supervisors'],
        queryFn: fetchSupervisors,
        staleTime: 5 * 60 * 1000,
    });
    const finalProductionLine: ProductionLinePayload = {
        line_name: newProductionLine.line_name,
        supervisor_id: Number(newProductionLine.supervisor_id),
    };

    // Batches state
    const { data: batches = [],
        // isLoading: loadingBatches 
    } = useQuery({
        queryKey: ["batches"],
        queryFn: fetchBatches,
        staleTime: 5 * 60 * 1000,
    });

    const [newBatch, setNewBatch] = useState<BatchPayload>({
        line_id: '',
        supervisor_id: '',
        farmer_id: '',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        initial_bird_count: '',
        current_bird_count: '',
        chick_item_code: [],
        created_by: '',
    });

    // Requirements state
    const { data: requirements = [],
        // isLoading: loadingRequirements 
    } = useQuery({
        queryKey: ["batch_requirements"],
        queryFn: fetchBatchRequirements,
        staleTime: 5 * 60 * 1000,
    });
    const [newRequirement, setNewRequirement] = useState<NewBatchRequirement>({
        batch_id: '',
        line_id: '',
        farmer_id: '',
        supervisor_id: '',
        item_code: '',
        quantity: ''
    });

    // Batch Allocations state
    const { data: allocations = [],
        //  isLoading: loadingAllocations 
    } = useQuery({
        queryKey: ["batch_allocations"],
        queryFn: fetchBatchAllocations,
        staleTime: 5 * 60 * 1000,
    });

    // Inventory state
    const { data: inventory = [],
        // isLoading: loadingInventory 
    } = useQuery({
        queryKey: ['inventory'],
        queryFn: fetchInventory,
        staleTime: 5 * 60 * 1000,
    });

    const [newInventory, setNewInventory] = useState<NewInventory>({
        item_code: '',
        item_name: '',
        current_qty: ''
    });

    // Add this function to handle item code selection for inventory
    const handleInventoryItemCodeSelect = (itemCode: string) => {
        const selectedItem = items.find(item => item.item_code === itemCode);
        if (selectedItem) {
            setNewInventory(prev => ({
                ...prev,
                item_code: itemCode,
                item_name: selectedItem.item_name
            }));
        }
    };

    // Create final payload for inventory
    const finalInventory: InventoryPayload = {
        item_code: newInventory.item_code,
        current_qty: Number(newInventory.current_qty),
    };

    // Add this function to handle inventory updates
    const handleInventoryUpdate = (item_code: string, current_qty: number) => {
        handleUpdateInventory(item_code, { current_qty }, queryClient);
    };

    // Fetch inventory movements
    const { data: inventoryMovements = [],
        // isLoading: loadingInventoryMovements 
    } = useQuery({
        queryKey: ["inventory_movements"],
        queryFn: fetchInventoryMovements,
        staleTime: 5 * 60 * 1000,
    });
    const [newMovement, setNewMovement] = useState<NewInventoryMovement>({
        item_code: '',
        item_name: '',
        qty_change: '',
        movement_type: MovementType.PURCHASE,
        reference_id: '',
        movement_date: new Date().toISOString().slice(0, 10)
    });

    const handleMovementItemCodeSelect = (itemCode: string) => {
        const selectedItem = items.find(item => item.item_code === itemCode);
        if (selectedItem) {
            setNewMovement(prev => ({
                ...prev,
                item_code: itemCode,
                item_name: selectedItem.item_name
            }));
        }
    };
    const movementPayload: InventoryMovementPayload = {
        item_code: newMovement.item_code,
        qty_change: Number(newMovement.qty_change),
        movement_type: newMovement.movement_type,
        reference_id: newMovement.reference_id ? Number(newMovement.reference_id) : undefined,
        movement_date: newMovement.movement_date,
    };

    // Ledger Entries state
    const { data: ledgerEntries = [],
        // isLoading: loadingLedgerEntries
    } = useQuery({
        queryKey: ["ledger_entries"],
        queryFn: fetchLedgerEntries,
        staleTime: 5 * 60 * 1000,
    });

    const [newLedgerEntry, setNewLedgerEntry] = useState<NewLedgerEntry>({
        account_id: '',
        debit: '',
        credit: '',
        txn_date: new Date().toISOString().slice(0, 10),
        reference_table: '',
        reference_id: '',
        narration: ''
    });

    const finalLedgerEntry: LedgerEntryPayload = {
        account_id: Number(newLedgerEntry.account_id),
        debit: newLedgerEntry.debit ? Number(newLedgerEntry.debit) : undefined,
        credit: newLedgerEntry.credit ? Number(newLedgerEntry.credit) : undefined,
        txn_date: newLedgerEntry.txn_date,
        reference_table: newLedgerEntry.reference_table || undefined,
        reference_id: newLedgerEntry.reference_id ? Number(newLedgerEntry.reference_id) : undefined,
        narration: newLedgerEntry.narration || undefined,
        created_by: user ? user.user_id : undefined,
    };

    // Stock Receipts state
    const { data: stockReceipts = [],
        // isLoading: loadingStockReceipts 
    } = useQuery({
        queryKey: ['stock_receipts'],
        queryFn: fetchStockReceipts,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });

    const [newStockReceipt, setNewStockReceipt] = useState<NewStockReceipt>({
        purchase_id: '',
        item_code: '',
        item_name: '',
        received_qty: '',
        remaining_qty: '',
        unit_cost: '',
        received_date: new Date().toISOString().slice(0, 10),
        supplier: ''
    });

    //  batch allocation lines
    const { data: allocationLines = [],
        // isLoading: loadingAllocationLines
    } = useQuery({
        queryKey: ["batch_allocation_lines"],
        queryFn: fetchBatchAllocationLines,
        staleTime: 5 * 60 * 1000,
    });
    const [newAllocationLine, setNewAllocationLine] = useState<NewBatchAllocationLine>({
        allocation_id: '',
        lot_id: '',
        qty: '',
        unit_cost: ''
    });

    const finalAllocationLine: BatchAllocationLinePayload = {
        allocation_id: Number(newAllocationLine.allocation_id),
        lot_id: Number(newAllocationLine.lot_id),
        qty: Number(newAllocationLine.qty),
        unit_cost: Number(newAllocationLine.unit_cost),
        line_value: Number(newAllocationLine.qty) * Number(newAllocationLine.unit_cost)
    };

    // Ledger Accounts state
    const { data: ledgerAccounts = [],
        //  isLoading: loadingLedgerAccounts
    } = useQuery({
        queryKey: ['ledger_accounts'],
        queryFn: fetchLedgerAccounts,
        staleTime: 5 * 60 * 1000,
    });

    const [newLedgerAccount, setNewLedgerAccount] = useState<NewLedgerAccount>({
        name: '',
        account_type: '',
        current_balance: ''
    });
    const { data: commissionHistory = [] } = useQuery({
        queryKey: ['farmer-commission-history'],
        queryFn: fetchFarmerCommissionHistory,
        staleTime: 5 * 60 * 1000,
    });

    const [commissionLoading, setCommissionLoading] = useState(false);

    const { data: birdCountHistory = [], isLoading: loadingBirdCountHistory } = useQuery({
        queryKey: ['bird_count_history'],
        queryFn: fetchBirdCountHistory,
        staleTime: 5 * 60 * 1000,
    });

    const [newBirdCountRecord, setNewBirdCountRecord] = useState<NewBirdCountHistory>({
        batch_id: '',
        record_date: new Date().toISOString().slice(0, 10),
        deaths: '',
        additions: '',
        notes: ''
    });


    const tabs = [
        'Users', 'Ledger Accounts', 'Ledger Entries', 'Production Lines', 'Purchases', 'Items', 'Inventory', 'Inventory Movements', 'Stock Receipts', 'Batch Allocation Lines', 'Batches', 'Batch Requirements',
        'Batch Allocations', 'Farmers', 'Traders', 'Suppliers', 'Batch Closures', 'Batch Sales', 'Bird Count History', 'Bird Sell History'
    ];

    const onAddFarmerCommission = async (commission: CreateFarmerCommission) => {
        const payload: CreateFarmerCommission = {
            farmer_id: commission.farmer_id,
            commission_amount: typeof commission.commission_amount === 'string'
                ? parseFloat(commission.commission_amount)
                : commission.commission_amount,
            description: commission.description,
            created_by: commission.created_by
        };

        return handleAddFarmerCommission(
            payload,
            queryClient,
            setCommissionLoading,
            () => {
                // Success callback - commission form will be reset in the component
            },
            (error) => {
                console.error('Failed to add commission:', error);
            }
        );
    };



    const handleItemCodeSelect = (itemCode: string) => {
        const selectedItem = items.find(item => item.item_code === itemCode);
        if (selectedItem) {
            setNewPurchase(prev => ({
                ...prev,
                item_code: itemCode,
                item_name: selectedItem.item_name
            }));
        }
    };
    const handleStockReceiptItemCodeSelect = (itemCode: string) => {
        const selectedItem = items.find(item => item.item_code === itemCode);
        if (selectedItem) {
            setNewStockReceipt(prev => ({
                ...prev,
                item_code: itemCode,
                item_name: selectedItem.item_name
            }));
        }
    };

    const handleStockReceiptPurchaseSelect = (purchaseId: string) => {
        const selectedPurchase = purchases.find(purchase => purchase.purchase_id === parseInt(purchaseId));
        if (selectedPurchase) {
            setNewStockReceipt(prev => ({
                ...prev,
                purchase_id: parseInt(purchaseId),
                item_code: selectedPurchase.item_code,
                item_name: selectedPurchase.item_name,
                unit_cost: selectedPurchase.cost_per_unit,
                supplier: selectedPurchase.supplier
            }));
        } else {
            setNewStockReceipt(prev => ({
                ...prev,
                purchase_id: purchaseId ? parseInt(purchaseId) : ''
            }));
        }
    };

    const [batchClosureLoading, setBatchClosureLoading] = useState(false);

    const onCloseBatch = async (batchClosure: BatchClosurePayload) => {
        await handleCloseBatch(
            batchClosure,
            queryClient,
            setBatchClosureLoading,
        );
    };

    const finalStockReceipt: StockReceiptPayload = {
        purchase_id: newStockReceipt.purchase_id ? Number(newStockReceipt.purchase_id) : undefined,
        item_code: newStockReceipt.item_code,
        received_qty: Number(newStockReceipt.received_qty),
        unit_cost: Number(newStockReceipt.unit_cost),
        received_date: newStockReceipt.received_date,
        supplier: newStockReceipt.supplier || undefined,
    };

    const { data: batchClosures = [], isLoading: loadingBatchClosures } = useQuery({
        queryKey: ["batch_closures"],
        queryFn: fetchBatchClosures,
        staleTime: 5 * 60 * 1000,
    });

    const [newBatchSale, setNewBatchSale] = useState<NewBatchSale>({
        item_code: '',
        item_name: '',
        batch_id: '',
        farmer_name: '',
        trader_id: '',
        trader_name: '',
        avg_weight: '',
        rate: '',
        quantity: '',
        value: ''
    });

    const { data: batchSales = [], isLoading: loadingBatchSales } = useQuery({
        queryKey: ['batch_sales'],
        queryFn: fetchBatchSales,
        staleTime: 5 * 60 * 1000,
    });

    const handleItemCodeSelect2 = (itemCode: string) => {
        const selectedItem = items.find(item => item.item_code === itemCode);
        if (selectedItem) {
            setNewBatchSale(prev => ({
                ...prev,
                item_code: itemCode,
                item_name: selectedItem.item_name
            }));
        }
    };

    const handleBatchSelect = (batchId: number) => {
        const selectedBatch = batches.find(batch => batch.batch_id === batchId);
        if (selectedBatch) {
            setNewBatchSale(prev => ({
                ...prev,
                batch_id: batchId,
                farmer_name: selectedBatch.farmer_name
            }));
        }
    };

    const handleTraderSelect = (traderId: number) => {
        const selectedTrader = traders.find(trader => trader.trader_id === traderId);
        if (selectedTrader) {
            setNewBatchSale(prev => ({
                ...prev,
                trader_id: traderId,
                trader_name: selectedTrader.name
            }));
        }
    };
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);



    return (
        <div className="min-h-screen bg-gray-100">
            <div className="p-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
                <Greeter user={user} />
                {/* Tab Navigation */}
                <div className="mb-6">
                    {/* Desktop tabs - hidden on mobile */}
                    <div className="hidden md:flex flex-wrap gap-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ease-in-out transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/25 ${activeTab === tab
                                    ? 'bg-green-600 text-white shadow-md border-green-600'
                                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-green-400'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Mobile menu - visible on mobile */}
                    <div className="md:hidden">
                        {/* Menu button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-green-400 transition-all duration-300 ease-in-out"
                        >
                            <span>{activeTab}</span>
                            <svg
                                className={`w-4 h-4 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'rotate-180' : ''
                                    }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>

                        {/* Dropdown menu */}
                        {isMobileMenuOpen && (
                            <div className="mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => {
                                            setActiveTab(tab);
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={`w-full px-4 py-3 text-left text-sm font-medium transition-all duration-300 ease-in-out ${activeTab === tab
                                            ? 'bg-green-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {activeTab === 'Production Lines' && (
                    <ProductionLinesTable
                        productionLines={productionLines}
                        supervisors={supervisors}
                        loading={loading}
                        showAddForm={showAddForm}
                        newProductionLine={newProductionLine}
                        setShowAddForm={setShowAddForm}
                        setNewProductionLine={setNewProductionLine}
                        handleAddProductionLine={() =>
                            handleAddProductionLine(finalProductionLine, queryClient, setLoading)
                        }
                    />
                )}

                {/* Content */}
                {activeTab === 'Purchases' && (
                    <PurchasesTable
                        purchases={purchases}
                        items={items}
                        loading={loading}
                        showAddForm={showAddForm}
                        newPurchase={newPurchase}
                        setShowAddForm={setShowAddForm}
                        setNewPurchase={setNewPurchase}
                        handleItemCodeSelect={handleItemCodeSelect}
                        handleAddPurchase={() =>
                            handleAddPurchase(final, queryClient, setLoading)
                        }
                    />
                )}

                {activeTab === 'Items' && (
                    <ItemsTable
                        items={items}
                        loading={loading}
                        showAddForm={showAddItemForm}
                        newItem={newItem}
                        setShowAddForm={setShowAddItemForm}
                        setNewItem={setNewItem}
                        handleAddItem={() =>
                            handleAddItem(newItem, queryClient, setLoading)
                        }
                    />
                )}

                {activeTab === 'Farmers' && (
                    <FarmersTable
                        farmers={farmers}
                        loading={loading}
                        showAddForm={showAddForm}
                        newFarmer={newFarmer}
                        setShowAddForm={setShowAddForm}
                        setNewFarmer={setNewFarmer}
                        handleAddFarmer={() => handleAddFarmer(newFarmer, queryClient, setLoading)}
                    />
                )}

                {activeTab === 'Suppliers' && (
                    <SuppliersTable
                        suppliers={suppliers}
                        loading={loading}
                        showAddForm={showAddForm}
                        newSupplier={newSupplier}
                        setShowAddForm={setShowAddForm}
                        setNewSupplier={setNewSupplier}
                        handleAddSupplier={() =>
                            handleAddSupplier(newSupplier, queryClient, setLoading)
                        }
                    />
                )}
                {activeTab === 'Traders' && (
                    <TradersTable
                        traders={traders}
                        loading={loading}
                        showAddForm={showAddForm}
                        newTrader={newTrader}
                        setShowAddForm={setShowAddForm}
                        setNewTrader={setNewTrader}
                        handleAddTrader={() =>
                            handleAddTrader(newTrader, queryClient, setLoading)
                        }
                    />
                )}

                {activeTab === 'Batches' && (
                    <BatchesTable
                        batches={batches}
                        farmers={farmers}
                        supervisors={supervisors}
                        items={items}
                        loading={loading}
                        showAddForm={showAddForm}
                        newBatch={newBatch}
                        setShowAddForm={setShowAddForm}
                        setNewBatch={setNewBatch}
                        handleAddBatch={() => handleAddBatch(newBatch, queryClient, setLoading)}
                        batchAllocations={allocations}
                        requirements={requirements}
                        commissionHistory={commissionHistory}
                        onAddCommission={onAddFarmerCommission}
                        commissionLoading={commissionLoading}
                        onCloseBatch={onCloseBatch}
                        batchClosureLoading={batchClosureLoading}
                    />
                )}

                {activeTab === 'Batch Requirements' && (
                    <BatchRequirementsTable
                        requirements={requirements}
                        batches={batches}
                        lines={productionLines}
                        farmers={farmers}
                        supervisors={supervisors}
                        items={items}
                        loading={loading}
                        showAddForm={showAddForm}
                        newRequirement={newRequirement}
                        setShowAddForm={setShowAddForm}
                        setNewRequirement={setNewRequirement}
                        handleAddRequirement={() => handleAddBatchRequirement(newRequirement, queryClient, setLoading)}
                    />
                )}

                {activeTab === 'Batch Allocations' && (
                    <BatchAllocationsTable
                        batchAllocations={allocations}
                        loading={loading}
                        showAddForm={showAddForm}
                        setShowAddForm={setShowAddForm}
                    />
                )}

                {activeTab === 'Inventory' && (
                    <InventoryTable
                        inventory={inventory}
                        items={items}
                        loading={loading}
                        showAddForm={showAddForm}
                        newInventory={newInventory}
                        setShowAddForm={setShowAddForm}
                        setNewInventory={setNewInventory}
                        handleItemCodeSelect={handleInventoryItemCodeSelect}
                        handleAddInventory={() =>
                            handleAddInventory(finalInventory, queryClient, setLoading, () => {
                                setNewInventory({ item_code: '', item_name: '', current_qty: '' });
                                setShowAddForm(false);
                            })
                        }
                        handleUpdateInventory={handleInventoryUpdate}
                    />
                )}

                {activeTab === 'Inventory Movements' && (
                    <InventoryMovementsTable
                        inventoryMovements={inventoryMovements}
                        items={items}
                        loading={loading}
                        showAddForm={showAddForm}
                        newMovement={newMovement}
                        setShowAddForm={setShowAddForm}
                        setNewMovement={setNewMovement}
                        handleItemCodeSelect={handleMovementItemCodeSelect}
                        handleAddMovement={() =>
                            handleAddInventoryMovement(movementPayload, queryClient, setLoading, () => {
                                setShowAddForm(false);
                                setNewMovement({
                                    item_code: '',
                                    item_name: '',
                                    qty_change: '',
                                    movement_type: MovementType.PURCHASE,
                                    reference_id: '',
                                    movement_date: new Date().toISOString().slice(0, 10)
                                });
                            })
                        }
                    />
                )}

                {activeTab === 'Ledger Entries' && (
                    <LedgerEntriesTable
                        ledgerEntries={ledgerEntries}
                        ledgerAccounts={ledgerAccounts} // Add this line
                        loading={loading}
                        showAddForm={showAddForm}
                        newLedgerEntry={newLedgerEntry}
                        setShowAddForm={setShowAddForm}
                        setNewLedgerEntry={setNewLedgerEntry}
                        handleAddLedgerEntry={() =>
                            handleAddLedgerEntry(finalLedgerEntry, queryClient, setLoading, () => {
                                setShowAddForm(false);
                                setNewLedgerEntry({
                                    account_id: '', // Updated field
                                    debit: '',
                                    credit: '',
                                    txn_date: new Date().toISOString().slice(0, 10),
                                    reference_table: '',
                                    reference_id: '',
                                    narration: ''
                                });
                            })
                        }
                    />
                )}

                {activeTab === 'Stock Receipts' && (
                    <StockReceiptsTable
                        stockReceipts={stockReceipts}
                        items={items}
                        purchases={purchases}
                        loading={loading}
                        showAddForm={showAddForm}
                        newStockReceipt={newStockReceipt}
                        setShowAddForm={setShowAddForm}
                        setNewStockReceipt={setNewStockReceipt}
                        handleItemCodeSelect={handleStockReceiptItemCodeSelect}
                        handlePurchaseSelect={handleStockReceiptPurchaseSelect}
                        handleAddStockReceipt={() =>
                            handleAddStockReceipt(finalStockReceipt, queryClient, setLoading)
                        }
                    />
                )}

                {activeTab === 'Batch Allocation Lines' && (
                    <BatchAllocationLinesTable
                        allocationLines={allocationLines}
                        batchAllocations={allocations}
                        stockReceipts={stockReceipts}
                        loading={loading}
                        showAddForm={showAddForm}
                        newAllocationLine={newAllocationLine}
                        setShowAddForm={setShowAddForm}
                        setNewAllocationLine={setNewAllocationLine}
                        handleAddAllocationLine={() =>
                            handleAddBatchAllocationLine(finalAllocationLine, queryClient, setLoading)
                        }
                        handleDeleteAllocationLine={(id) =>
                            handleDeleteBatchAllocationLine(id, queryClient)
                        }
                    />
                )}

                {activeTab === 'Ledger Accounts' && (
                    <LedgerAccountsTable
                        ledgerAccounts={ledgerAccounts}
                        loading={loading}
                        showAddForm={showAddForm}
                        newLedgerAccount={newLedgerAccount}
                        setShowAddForm={setShowAddForm}
                        setNewLedgerAccount={setNewLedgerAccount}
                        handleAddLedgerAccount={() =>
                            handleAddLedgerAccount(
                                {
                                    name: newLedgerAccount.name,
                                    account_type: newLedgerAccount.account_type,
                                    current_balance: Number(newLedgerAccount.current_balance)
                                },
                                queryClient,
                                setLoading
                            )
                        }
                    />
                )}

                {activeTab === 'Bird Count History' && (
                    <BirdCountHistoryTable
                        birdCountHistory={birdCountHistory}
                        batches={batches}
                        loading={loading}
                        showAddForm={showAddForm}
                        newRecord={newBirdCountRecord}
                        setShowAddForm={setShowAddForm}
                        setNewRecord={setNewBirdCountRecord}
                        handleAddRecord={() =>
                            handleAddBirdCountHistory({
                                batch_id: Number(newBirdCountRecord.batch_id),
                                record_date: newBirdCountRecord.record_date,
                                deaths: Number(newBirdCountRecord.deaths),
                                additions: Number(newBirdCountRecord.additions),
                                notes: newBirdCountRecord.notes || undefined
                            }, queryClient, setLoading, () => {
                                setShowAddForm(false);
                                setNewBirdCountRecord({
                                    batch_id: '',
                                    record_date: new Date().toISOString().slice(0, 10),
                                    deaths: '',
                                    additions: '',
                                    notes: ''
                                });
                            })
                        }
                    />
                )}

                {activeTab === 'Batch Closures' && (
                    <BatchClosureSummaryTable
                        batchClosures={batchClosures}
                        batches={batches}
                        loading={loading}
                        showAddForm={showAddForm}
                        setShowAddForm={setShowAddForm}
                    />
                )}

                {activeTab === 'Batch Sales' && (
                    <BatchSalesTable
                        batchSales={batchSales}
                        items={items}
                        batches={batches}
                        traders={traders}
                        loading={loading}
                        showAddForm={showAddForm}
                        newBatchSale={newBatchSale}
                        setShowAddForm={setShowAddForm}
                        setNewBatchSale={setNewBatchSale}
                        handleItemCodeSelect={handleItemCodeSelect2}
                        handleBatchSelect={handleBatchSelect}
                        handleTraderSelect={handleTraderSelect}
                        handleAddBatchSale={() => {
                            const payload: BatchSalePayload = {
                                item_code: newBatchSale.item_code,
                                batch_id: Number(newBatchSale.batch_id),
                                trader_id: Number(newBatchSale.trader_id),
                                avg_weight: Number(newBatchSale.avg_weight),
                                rate: Number(newBatchSale.rate),
                                quantity: Number(newBatchSale.quantity),
                                value: Number(newBatchSale.value),
                                created_by: user ? user.user_id : 9999
                            };
                            handleAddBatchSale(payload, queryClient, setLoading, () => {
                                setNewBatchSale({
                                    item_code: '',
                                    item_name: '',
                                    batch_id: '',
                                    farmer_name: '',
                                    trader_id: '',
                                    trader_name: '',
                                    avg_weight: '',
                                    rate: '',
                                    quantity: '',
                                    value: ''
                                });
                                setShowAddForm(false);
                            });
                        }}
                    />
                )}

                {activeTab !== 'Purchases' && activeTab !== 'Items' && activeTab !== 'Farmers' && activeTab !== 'Suppliers' &&
                    activeTab !== 'Traders' &&
                    activeTab !== 'Production Lines' &&
                    activeTab !== 'Batches' &&
                    activeTab !== 'Batch Requirements' &&
                    activeTab !== 'Batch Allocations' &&
                    activeTab !== 'Inventory' &&
                    activeTab !== 'Inventory Movements' &&
                    activeTab !== 'Ledger Entries' &&
                    activeTab !== 'Stock Receipts' &&
                    activeTab !== 'Batch Allocation Lines' &&
                    activeTab !== 'Ledger Accounts' &&
                    activeTab !== 'Bird Count History' &&
                    activeTab !== 'Batch Closures' &&
                    activeTab !== 'Batch Sales' && (

                        <div className="bg-white rounded-lg shadow p-8 text-center">
                            <h2 className="text-xl font-semibold text-gray-800 mb-2">{activeTab}</h2>
                            <p className="text-gray-600">This section is under development</p>
                        </div>
                    )}



            </div>
        </div>
    );
};

export default Dashboard;