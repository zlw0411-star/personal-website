import EntryEditor from "@/components/admin/EntryEditor";
export default async function NewEntryPage({searchParams}:{searchParams:Promise<{category?:string|string[]}>}){
 const params=await searchParams;
 const initialCategory=params.category==="life"||params.category==="learning"?params.category:"learning";
 return <EntryEditor key={initialCategory} initialCategory={initialCategory}/>;
}
