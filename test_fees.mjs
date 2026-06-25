import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFees() {
    const businessId = "6b567d26-7f41-4770-9831-29e20a0684f8";
    
    // Get an enrollment to test with
    const { data: enrollments, error: err } = await supabase
        .from("school_enrollments")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (err) {
        console.error("Error fetching enrollment:", err);
        return;
    }

    if (enrollments.length === 0) {
        console.log("No enrollments found");
        return;
    }

    const enrollment = enrollments[0];
    console.log("Testing with enrollment:", enrollment);

    const { data: fees, error } = await supabase
      .from("school_fees")
      .select("*, category:category_id(*)")
      .eq("class_id", enrollment.class_id)
      .eq("academic_year_id", enrollment.academic_year_id);
    
    if (error) {
        console.error("Error fetching fees:", error);
        return;
    }

    console.log("Fees for class:", JSON.stringify(fees, null, 2));
    
    let enrollmentFees = fees.filter(f => f.category?.fee_type === 'enrollment');
    const tuitionFees = fees.filter(f => f.category?.fee_type !== 'enrollment');

    console.log("Enrollment Fees:", enrollmentFees.length);
    console.log("Tuition Fees:", tuitionFees.length);
}

testFees();
