// src/memoryData.js
import { supabase } from './supabaseClient';

export const searchMemoryItems = async (searchString) => {
  const { data, error } = await supabase
    .from('memory_items')
    .select('*')
    .or(
      `name.ilike.%${searchString}%,description.ilike.%${searchString}%,code_snippet.ilike.%${searchString}%`
    );

  if (error) {
    console.error("Error fetching memory items:", error);
    return [];
  }

  return data;
};



// Fetch memory tree data from Supabase, order it by integer memory_key, and structure it as a nested tree
export const fetchMemoryTree = async () => {

  const { data, error } = await supabase
    .from('memory_tree_with_starred')
    .select('*')
    .range(0, 9999); // Can now exceed 1000 safely

  if (error) {
    console.error("Error fetching memory tree view:", error);
    return [];
  }

  console.log("fetchMemoryTree data length = ", data.length);

  // Sort data with null parent_id items first, ordered by integer memory_key
  data.sort((a, b) => {
    if (a.parent_id === null && b.parent_id !== null) return -1;
    if (a.parent_id !== null && b.parent_id === null) return 1;
    if (a.parent_id === b.parent_id) {
      // Convert memory_key to integer for comparison
      return parseInt(a.memory_key, 10) - parseInt(b.memory_key, 10);
    }
    return 0;
  });

  const dataMap = {};
  data.forEach((item) => {
    dataMap[item.id] = { ...item, children: [] };
  });

  //console.log("dataMap = ", dataMap);

  const nestedData = [];
  data.forEach((item) => {
    if (item.parent_id === null) {
      nestedData.push(dataMap[item.id]);
    } else if (dataMap[item.parent_id]) {
      dataMap[item.parent_id].children.push(dataMap[item.id]);
    }
  });

  //console.log("nestedData = ", nestedData);

  return nestedData;
};

// // Fetch memory tree data from Supabase, order it, and structure it as a nested tree
// export const fetchMemoryTree = async () => {
//     const { data, error } = await supabase.rpc('fetch_memory_tree');
//     if (error) {
//       console.error("Error fetching memory tree:", error);
//       return [];
//     }

//     // Sort data with null parent_id items first, ordered by memory_key
//     data.sort((a, b) => {
//       if (a.parent_id === null && b.parent_id !== null) return -1;
//       if (a.parent_id !== null && b.parent_id === null) return 1;
//       if (a.parent_id === b.parent_id) {
//         return a.memory_key.localeCompare(b.memory_key);
//       }
//       return 0;
//     });

//     const dataMap = {};
//     data.forEach((item) => {
//       dataMap[item.id] = { ...item, children: [] };
//     });

//     const nestedData = [];
//     data.forEach((item) => {
//       if (item.parent_id === null) {
//         nestedData.push(dataMap[item.id]);
//       } else if (dataMap[item.parent_id]) {
//         dataMap[item.parent_id].children.push(dataMap[item.id]);
//       }
//     });

//     return nestedData;
//   };


// Fetch memory tree data from Supabase and structure it as a nested tree
export const fetchMemoryTreeOriginal = async () => {
  const { data, error } = await supabase.rpc('fetch_memory_tree');
  if (error) {
    console.error("Error fetching memory tree:", error);
    return [];
  }

  const dataMap = {};
  data.forEach((item) => {
    dataMap[item.id] = { ...item, children: [] };
  });

  const nestedData = [];
  data.forEach((item) => {
    if (item.parent_id === null) {
      nestedData.push(dataMap[item.id]);
    } else if (dataMap[item.parent_id]) {
      dataMap[item.parent_id].children.push(dataMap[item.id]);
    }
  });

  return nestedData;
};

// Update the starred status of an item
export const updateStarred = async (memoryId, starredStatus) => {
  console.log("updateStarred", memoryId, starredStatus)

  try {
    const { error } = await supabase
      .from('memory_items')
      .update({ starred: starredStatus })
      .eq('id', memoryId);

    if (error) throw error;
  } catch (err) {
    console.log("Error updating starred item");
  }
}

export const updateMemoryItemParent = async (draggedItemIds, newParentId) => {
  try {
    // Normalize to array
    const ids = Array.isArray(draggedItemIds) ? draggedItemIds : [draggedItemIds];

    if (ids.includes(newParentId)) {
      console.error("Cannot drop an item onto itself.");
      return;
    }

    console.log("Updating parent_id =", newParentId, "for ids =", ids);

    const { error } = await supabase
      .from('memory_items')
      .update({ parent_id: newParentId })
      .in('id', ids); // Bulk update with .in()

    if (error) throw error;
  } catch (err) {
    console.error("Error updating memory item(s):", err);
  }
};


// // Update the parent_id of a memory item (drag and drop logic)
// export const updateMemoryItemParent = async (draggedItemId, newParentId) => {
//   try {
//     if (draggedItemId === newParentId) {
//       console.error("Cannot drop an item onto itself.");
//       return;
//     }

//     console.log("update parent id = ", newParentId, " where id = ", draggedItemId);
//     const { error } = await supabase
//       .from('memory_items')
//       .update({ parent_id: newParentId })
//       .eq('id', draggedItemId);

//     if (error) throw error;
//   } catch (err) {
//     console.error("Error updating memory item:", err);
//   }
// };

// Update a memory item in Supabase (for the edit form)
export const updateMemoryItem = async (id, memory_key, name, memory_image, code_snippet, description) => {
  const { error } = await supabase
    .from('memory_items')
    .update({ memory_key, name, memory_image, code_snippet, description })
    .eq('id', id);

  if (error) {
    console.error("Error updating memory item:", error);
  } else {
    console.log("Item updated successfully!");
  }
};
