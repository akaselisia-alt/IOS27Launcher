package com.ios27.launcher

import android.annotation.SuppressLint
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class AppAdapter(
    private var all: List<AppInfo>,
    private val onClick: (AppInfo) -> Unit
) : RecyclerView.Adapter<AppAdapter.VH>() {

    private var query = ""
    private var shown: List<AppInfo> = all

    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val icon: ImageView = v.findViewById(R.id.appIcon)
        val name: TextView = v.findViewById(R.id.appName)
    }

    @SuppressLint("NotifyDataSetChanged")
    private fun refilter() {
        shown = if (query.isEmpty()) all else all.filter { it.name.contains(query, ignoreCase = true) }
        notifyDataSetChanged()
    }

    fun submit(list: List<AppInfo>) {
        all = list
        refilter()
    }

    fun filter(q: String) {
        query = q.trim()
        refilter()
    }

    fun first(): AppInfo? = shown.firstOrNull()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH =
        VH(LayoutInflater.from(parent.context).inflate(R.layout.item_app, parent, false))

    override fun getItemCount(): Int = shown.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val app = shown[position]
        holder.icon.setImageDrawable(app.icon)
        holder.name.text = app.name
        holder.itemView.setOnClickListener { onClick(app) }
    }
}
