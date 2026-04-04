export type PackageType = 'basic' | 'premium';
export type Duration = '1_month' | '6_months' | '1_year';

export interface OrderInput {
  packageType: PackageType;
  duration: Duration;
  isRenewal: boolean;
  cameraCount: number;
}

export function calculateOrder(input: OrderInput) {
  // hardware costs
  const CAMERA_COST = 2700;
  const MEMORY_COST = 1500;
  const ACCESORIES_COST = 1000;
  
  // telecom cost logic
  // Initial 6-Month: basic=6000, premium=9000
  // Renewal 6-Month net: basic=4883, premium=7812
  
  // Customer revenue logic
  // 1 Month: basic 7000, premium 8000
  // 6 Months: basic 10000, premium 15000
  // 1 Year: basic 18000, premium 25000
  // 1 Month (renewal): basic 2000, premium 3000
  
  // Customer CCTV Addon Revenue
  // Per Camera = 6000
  
  const revenue = {
    wifi: 0,
    cctv: input.cameraCount * 6000, 
    total: 0
  };
  
  const cost = {
    hardwareTotal: 0,
    cameraPurchase: 0,
    memoryPurchase: 0,
    labor: 0,
    telecom: 0,
    accessories: 0,
    total: 0
  };

  // Labor rules
  if (input.cameraCount > 0) {
    if (input.cameraCount <= 2) cost.labor = 1500;
    else cost.labor = 2000;
  }

  if (input.isRenewal) {
     // Hardware depreciation applies only to existing router; newly added cameras MUST be strictly charged.
     cost.cameraPurchase = input.cameraCount * CAMERA_COST;
     cost.memoryPurchase = input.cameraCount * MEMORY_COST;
     cost.accessories = input.cameraCount > 0 ? ACCESORIES_COST : 0;
     
     if (input.duration === '1_month') {
        revenue.wifi = input.packageType === 'basic' ? 2000 : 3000;
        // Pro-rate telecom cost (monthly)
        cost.telecom = Math.round((input.packageType === 'basic' ? 4883 : 7812) / 6);
     } else if (input.duration === '6_months') {
         revenue.wifi = input.packageType === 'basic' ? 10000 : 15000;
         cost.telecom = input.packageType === 'basic' ? 4883 : 7812;
     } else if (input.duration === '1_year') {
         revenue.wifi = input.packageType === 'basic' ? 18000 : 25000;
         cost.telecom = (input.packageType === 'basic' ? 4883 : 7812) * 2;
     }
  } else {
     cost.cameraPurchase = input.cameraCount * CAMERA_COST;
     cost.memoryPurchase = input.cameraCount * MEMORY_COST;
     cost.accessories = ACCESORIES_COST;

     if (input.duration === '1_month') {
        revenue.wifi = input.packageType === 'basic' ? 7000 : 8000;
        cost.telecom = input.packageType === 'basic' ? 6000 : 9000; // initial telecom cost
     } else if (input.duration === '6_months') {
        revenue.wifi = input.packageType === 'basic' ? 10000 : 15000;
        cost.telecom = input.packageType === 'basic' ? 6000 : 9000; // initial telecom 6-month
     } else if (input.duration === '1_year') {
        revenue.wifi = input.packageType === 'basic' ? 18000 : 25000;
        
        // 1-Year Premium Split Logic (Rule 3)
        if (input.packageType === 'premium') {
            cost.telecom = 9000 + 4883; // Phase 1 10Mbps (9k) + Phase 2 Renewal 5Mbps (4883)
        } else {
            // Basic 1-year logic: assume 6-mo basic initial (6000) + 6-mo basic renewal (4883)
            cost.telecom = 6000 + 4883; 
        }
     }
  }

  cost.hardwareTotal = cost.cameraPurchase + cost.memoryPurchase + cost.accessories;
  cost.total = cost.hardwareTotal + cost.labor + cost.telecom;
  revenue.total = revenue.wifi + revenue.cctv;

  const profit = revenue.total - cost.total;
  
  return {
    revenue,
    cost,
    profit
  };
}
